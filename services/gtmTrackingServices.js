// services/unifiedGtmTrackingService.js - Complete unified tracking service
const gtmService = require('./gtmServices');
const { broadcastTrackingEvent } = require('./trackingEventEmitters');
const mongoose = require('mongoose');

// Default GTM configuration from env variables
const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID;
const DEFAULT_CONTAINER_ID = process.env.DEFAULT_CONTAINER_ID;
const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || 'default';
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || '{{GA4_MEASUREMENT_ID}}';

// Unified tracking event schema - handles both workflow and KYC events
const UnifiedTrackingEventSchema = new mongoose.Schema({
    // Basic event information
    event_type: String, // 'workflow_start', 'node_executed', 'kyc_verification', etc.
    event_category: String, // 'workflow', 'kyc', 'api', 'user_interaction', 'workflow_management'
    
    // Workflow context
    workflow_id: mongoose.Schema.Types.ObjectId,
    workflow_name: String,
    user_id: mongoose.Schema.Types.ObjectId,
    session_id: mongoose.Schema.Types.ObjectId,
    
    // Node context (for workflow events)
    node_id: String,
    node_name: String,
    node_type: String,
    
    // KYC specific context (for KYC events)
    kyc_step: String, // 'aadhaar', 'pan', 'bank_account', etc.
    verification_type: String, // 'ocr', 'otp', 'api_verification'
    
    // Input/interaction context
    input_variable: String,
    input_value: mongoose.Schema.Types.Mixed,
    condition_result: Boolean,
    
    // Performance metrics
    execution_time_ms: Number,
    response_time_ms: Number,
    
    // Status and results
    success: Boolean,
    completion_percentage: Number,
    error_message: String,
    
    // Additional context
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { 
    timestamps: true 
});

// Create unified model
let UnifiedTrackingEvent;
try {
    UnifiedTrackingEvent = mongoose.model('UnifiedTrackingEvents');
} catch (e) {
    UnifiedTrackingEvent = mongoose.model('UnifiedTrackingEvents', UnifiedTrackingEventSchema);
}

/**
 * Core tracking function - handles all types of events
 * @param {Object} eventData - Event data object
 * @returns {Promise<Object>} - Result of tracking operation
 */
async function trackEvent(eventData) {
    try {
        console.log(`📊 Tracking event: ${eventData.event_type} (${eventData.event_category})`);
        
        // Validate required fields
        if (!eventData.event_type || !eventData.event_category) {
            throw new Error('event_type and event_category are required');
        }
        
        // Save to database
        const trackingEvent = new UnifiedTrackingEvent(eventData);
        await trackingEvent.save();
        
        // Broadcast to WebSocket clients
        const broadcastData = {
            event: eventData.event_type,
            category: eventData.event_category,
            timestamp: new Date().toISOString(),
            ...eventData
        };
        
        // Remove sensitive data from broadcast
        if (broadcastData.input_value && typeof broadcastData.input_value === 'string') {
            const sensitiveFields = ['password', 'otp', 'pin', 'aadhaar', 'pan', 'account'];
            if (sensitiveFields.some(field => eventData.input_variable?.toLowerCase().includes(field))) {
                broadcastData.input_value = '[REDACTED]';
            }
        }
        
        broadcastTrackingEvent(broadcastData);
        
        // Create GTM tag if configured
        if (DEFAULT_ACCOUNT_ID && DEFAULT_CONTAINER_ID) {
            await createUnifiedGtmTag(eventData);
        }
        
        return { success: true, event_type: eventData.event_type };
    } catch (error) {
        console.error('Error in unified tracking:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Track workflow start
 */
async function trackWorkflowStart(session, workflow) {
    return await trackEvent({
        event_type: 'workflow_start',
        event_category: 'workflow',
        workflow_id: workflow._id,
        workflow_name: workflow.name,
        user_id: session.userId,
        session_id: session._id,
        success: true,
        metadata: {
            workflow_category: workflow.category,
            workflow_tags: workflow.tags,
            session_source: session.source,
            start_node_id: workflow.startNodeId,
            has_surepass_integration: workflow.metadata?.hasSurePassIntegration || false,
            surepass_endpoints: workflow.metadata?.surePassEndpoints || []
        }
    });
}

/**
 * Track node execution
 */
async function trackNodeExecution(session, node, executionTime = 0, success = true, errorMessage = null) {
    return await trackEvent({
        event_type: 'node_executed',
        event_category: 'workflow',
        workflow_id: session.workflowId,
        user_id: session.userId,
        session_id: session._id,
        node_id: node.nodeId,
        node_name: node.name,
        node_type: node.type,
        execution_time_ms: executionTime,
        success: success,
        error_message: errorMessage,
        metadata: {
            node_content_preview: node.content ? node.content.substring(0, 100) : null,
            has_conditions: !!node.condition,
            has_api_endpoint: !!node.apiEndpoint,
            next_node_id: node.nextNodeId,
            is_surepass_node: node.surePassConfig ? true : false,
            surepass_step: node.surePassConfig?.verificationStep || null
        }
    });
}

/**
 * Track user input
 */
async function trackUserInput(session, variableName, inputValue, nodeId, nodeName) {
    // Sanitize sensitive input
    let sanitizedValue = inputValue;
    const sensitiveFields = ['password', 'otp', 'pin', 'aadhaar', 'pan', 'account'];
    
    if (typeof inputValue === 'string' && sensitiveFields.some(field => 
        variableName.toLowerCase().includes(field))) {
        sanitizedValue = inputValue.length > 0 ? `[${inputValue.length} characters]` : '[empty]';
    }
    
    return await trackEvent({
        event_type: 'user_input',
        event_category: 'user_interaction',
        workflow_id: session.workflowId,
        user_id: session.userId,
        session_id: session._id,
        node_id: nodeId,
        node_name: nodeName,
        input_variable: variableName,
        input_value: sanitizedValue,
        success: true,
        metadata: {
            input_length: typeof inputValue === 'string' ? inputValue.length : null,
            input_type: typeof inputValue,
            is_sensitive: sensitiveFields.some(field => variableName.toLowerCase().includes(field))
        }
    });
}

/**
 * Track KYC verification step - UNIFIED with workflow tracking
 */
async function trackKycStep(user, kycStep, isCompleted = true, additionalData = {}) {
    const session = additionalData.session; // Pass session if available
    
    return await trackEvent({
        event_type: 'kyc_verification',
        event_category: 'kyc',
        workflow_id: session?.workflowId || null,
        user_id: user._id,
        session_id: session?._id || null,
        kyc_step: kycStep,
        verification_type: additionalData.verification_type || 'api_verification',
        success: isCompleted,
        execution_time_ms: additionalData.execution_time_ms || 0,
        metadata: {
            verification_provider: additionalData.provider || 'surepass',
            user_name: user.name,
            user_phone: user.phone,
            additional_context: additionalData.context || {},
            api_endpoint: additionalData.api_endpoint || null
        }
    });
}

/**
 * Track condition evaluation
 */
async function trackConditionEvaluation(session, condition, result, nodeId, nodeName, nextNodeId) {
    return await trackEvent({
        event_type: 'condition_evaluated',
        event_category: 'workflow',
        workflow_id: session.workflowId,
        user_id: session.userId,
        session_id: session._id,
        node_id: nodeId,
        node_name: nodeName,
        condition_result: result,
        success: true,
        metadata: {
            condition_expression: condition,
            next_node_id: nextNodeId,
            evaluation_path: result ? 'true_path' : 'false_path'
        }
    });
}

/**
 * Track API calls
 */
async function trackApiCall(session, apiEndpoint, method, success, responseTime, nodeId, nodeName) {
    // Determine if this is a KYC-related API call
    const isKycApi = apiEndpoint.includes('verification') || 
                     apiEndpoint.includes('surepass') || 
                     apiEndpoint.includes('kyc');
    
    const isSurePassApi = apiEndpoint.startsWith('/api/verification/');
    
    return await trackEvent({
        event_type: isKycApi ? 'kyc_api_call' : 'api_call',
        event_category: isKycApi ? 'kyc' : 'api',
        workflow_id: session.workflowId,
        user_id: session.userId,
        session_id: session._id,
        node_id: nodeId,
        node_name: nodeName,
        response_time_ms: responseTime,
        success: success,
        metadata: {
            api_endpoint: apiEndpoint,
            http_method: method,
            api_category: isKycApi ? 'kyc_verification' : 'general',
            is_surepass_api: isSurePassApi,
            verification_step: isSurePassApi ? apiEndpoint.split('/').pop() : null
        }
    });
}

/**
 * Track workflow completion
 */
async function trackWorkflowCompletion(session, workflow, totalExecutionTime = 0) {
    // Calculate metrics
    const totalNodes = workflow.nodes.length;
    const completedSteps = session.stepsCompleted ? session.stepsCompleted.length : 0;
    const completionPercentage = totalNodes > 0 ? Math.round((completedSteps / totalNodes) * 100) : 0;
    
    // Determine if this is a KYC workflow
    const isKycWorkflow = workflow.name.toLowerCase().includes('kyc') || 
                         workflow.category?.toLowerCase().includes('kyc') ||
                         workflow.metadata?.hasSurePassIntegration;
    
    return await trackEvent({
        event_type: isKycWorkflow ? 'kyc_workflow_complete' : 'workflow_complete',
        event_category: isKycWorkflow ? 'kyc' : 'workflow',
        workflow_id: workflow._id,
        workflow_name: workflow.name,
        user_id: session.userId,
        session_id: session._id,
        completion_percentage: completionPercentage,
        execution_time_ms: totalExecutionTime,
        success: true,
        metadata: {
            total_nodes: totalNodes,
            completed_steps: completedSteps,
            session_duration_ms: session.completedAt ? 
                (session.completedAt.getTime() - session.startedAt.getTime()) : null,
            interaction_count: session.interactionCount || 0,
            has_surepass_integration: workflow.metadata?.hasSurePassIntegration || false,
            surepass_steps_completed: workflow.metadata?.surePassEndpoints || []
        }
    });
}

/**
 * Create unified GTM tags that handle both workflow and KYC events
 */
async function createUnifiedGtmTag(eventData) {
    try {
        if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID === '{{GA4_MEASUREMENT_ID}}') {
            console.warn('GA4 measurement ID not configured properly.');
            return;
        }
        
        const accountId = DEFAULT_ACCOUNT_ID;
        const containerId = DEFAULT_CONTAINER_ID;
        const workspaceId = DEFAULT_WORKSPACE_ID;
        
        if (!accountId || !containerId) {
            console.error('GTM configuration missing.');
            return;
        }
        
        // Create comprehensive tag name
        const entityName = eventData.node_name || eventData.kyc_step || eventData.workflow_name || 'unknown';
        const cleanEntityName = entityName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const tagName = `UNIFIED_${eventData.event_category.toUpperCase()}_${eventData.event_type.toUpperCase()}_${cleanEntityName}_${eventData.user_id}`;
        
        // Get or create unified trigger
        let triggerId = await getOrCreateUnifiedTrigger(accountId, containerId, workspaceId);
        const triggerIds = triggerId ? [triggerId] : [];
        
        // Create comprehensive event parameters
        const eventParameters = [
            {
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'event_type' },
                    { key: 'value', type: 'template', value: eventData.event_type }
                ]
            },
            {
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'event_category' },
                    { key: 'value', type: 'template', value: eventData.event_category }
                ]
            },
            {
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'user_id' },
                    { key: 'value', type: 'template', value: eventData.user_id.toString() }
                ]
            }
        ];
        
        // Add workflow-specific parameters
        if (eventData.workflow_id) {
            eventParameters.push({
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'workflow_id' },
                    { key: 'value', type: 'template', value: eventData.workflow_id.toString() }
                ]
            });
        }
        
        // Add KYC-specific parameters
        if (eventData.kyc_step) {
            eventParameters.push({
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'kyc_step' },
                    { key: 'value', type: 'template', value: eventData.kyc_step }
                ]
            });
        }
        
        // Add performance metrics
        if (eventData.execution_time_ms) {
            eventParameters.push({
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'execution_time_ms' },
                    { key: 'value', type: 'template', value: eventData.execution_time_ms.toString() }
                ]
            });
        }
        
        if (eventData.completion_percentage) {
            eventParameters.push({
                type: 'map',
                map: [
                    { key: 'name', type: 'template', value: 'completion_percentage' },
                    { key: 'value', type: 'template', value: eventData.completion_percentage.toString() }
                ]
            });
        }
        
        // GA4 tag configuration
        const tagData = {
            name: tagName,
            type: 'gaawe', // Google Analytics 4 event
            parameter: [
                {
                    key: 'eventName',
                    type: 'template',
                    value: `${eventData.event_category}_${eventData.event_type}`
                },
                {
                    key: 'measurementIdOverride',
                    type: 'template',
                    value: GA4_MEASUREMENT_ID
                },
                {
                    key: 'eventParameters',
                    type: 'list',
                    list: eventParameters
                }
            ],
            ...(triggerIds.length > 0 && { firingTriggerId: triggerIds })
        };
        
        // Check if tag already exists
        const existingTags = await gtmService.getTags(accountId, containerId, workspaceId);
        const existingTag = existingTags.find(tag => tag.name === tagName);
        
        if (existingTag) {
            // Update existing tag
            const updateData = {
                ...existingTag,
                ...tagData,
                fingerprint: existingTag.fingerprint
            };
            
            return await gtmService.updateTag(accountId, containerId, workspaceId, existingTag.tagId, updateData);
        } else {
            // Create new tag
            return await gtmService.createTag(accountId, containerId, workspaceId, tagData);
        }
    } catch (error) {
        console.error('Error creating unified GTM tag:', error);
        // Non-blocking - don't throw errors from tracking
    }
}

/**
 * Get or create unified trigger for all tracking events
 */
async function getOrCreateUnifiedTrigger(accountId, containerId, workspaceId) {
    try {
        const triggers = await gtmService.getTriggers(accountId, containerId, workspaceId);
        let unifiedTrigger = triggers.find(trigger => trigger.name === 'UNIFIED_TRACKING_TRIGGER');
        
        if (!unifiedTrigger) {
            // Create the unified trigger
            unifiedTrigger = await gtmService.createTrigger(accountId, containerId, workspaceId, {
                name: 'UNIFIED_TRACKING_TRIGGER',
                type: 'customEvent',
                customEventFilter: [
                    {
                        type: 'equals',
                        parameter: [
                            {
                                key: 'arg0',
                                type: 'template',
                                value: '{{_event}}'
                            },
                            {
                                key: 'arg1',
                                type: 'template',
                                value: 'unified_tracking_event'
                            }
                        ]
                    }
                ]
            });
            console.log('✅ Created unified tracking trigger in GTM');
        }
        
        return unifiedTrigger?.triggerId;
    } catch (error) {
        console.error('Error getting/creating unified trigger:', error);
        return null;
    }
}

/**
 * Get comprehensive analytics combining workflow and KYC data
 */
async function getUnifiedAnalytics(workflowId, startDate, endDate) {
    try {
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
        }
        
        const query = { workflow_id: workflowId, ...dateFilter };
        
        // Get event counts by type and category
        const eventBreakdown = await UnifiedTrackingEvent.aggregate([
            { $match: query },
            { 
                $group: { 
                    _id: { event_type: '$event_type', event_category: '$event_category' },
                    count: { $sum: 1 },
                    avg_execution_time: { $avg: '$execution_time_ms' },
                    success_rate: { $avg: { $cond: ['$success', 1, 0] } }
                }
            }
        ]);
        
        // Get KYC completion funnel
        const kycFunnel = await UnifiedTrackingEvent.aggregate([
            { $match: { ...query, event_category: 'kyc' } },
            { 
                $group: { 
                    _id: '$kyc_step',
                    attempts: { $sum: 1 },
                    successes: { $sum: { $cond: ['$success', 1, 0] } },
                    avg_time: { $avg: '$execution_time_ms' }
                }
            },
            { $addFields: { success_rate: { $divide: ['$successes', '$attempts'] } } }
        ]);
        
        // Get user journey analysis
        const userJourneys = await UnifiedTrackingEvent.aggregate([
            { $match: query },
            { $sort: { user_id: 1, timestamp: 1 } },
            {
                $group: {
                    _id: '$user_id',
                    events: { 
                        $push: { 
                            event_type: '$event_type', 
                            timestamp: '$timestamp',
                            success: '$success'
                        } 
                    },
                    total_events: { $sum: 1 },
                    completion_percentage: { $max: '$completion_percentage' }
                }
            }
        ]);
        
        return {
            event_breakdown: eventBreakdown,
            kyc_funnel: kycFunnel,
            user_journeys: userJourneys,
            total_events: await UnifiedTrackingEvent.countDocuments(query)
        };
    } catch (error) {
        console.error('Error getting unified analytics:', error);
        return null;
    }
}

// Backward compatibility functions - these call the unified tracker
const trackKycStatus = async (user, kycStatus) => {
    const steps = Object.keys(kycStatus).filter(k => k.startsWith('is'));
    const completedSteps = steps.filter(step => kycStatus[step] === true).length;
    const completionPercentage = Math.round((completedSteps / steps.length) * 100);
    
    return await trackEvent({
        event_type: 'kyc_status_updated',
        event_category: 'kyc',
        user_id: user._id,
        completion_percentage: completionPercentage,
        success: true,
        metadata: {
            ...kycStatus,
            completed_steps: completedSteps,
            total_steps: steps.length
        }
    });
};

const pushDataLayerEvent = (session, eventName, eventData = {}) => {
    const payload = {
        event: eventName,
        session_id: session._id.toString(),
        user_id: session.userId.toString(),
        timestamp: new Date().toISOString(),
        ...eventData
    };
    
    broadcastTrackingEvent(payload);
    return true;
};

module.exports = {
    // Core unified tracking function
    trackEvent,
    
    // Workflow tracking functions
    trackWorkflowStart,
    trackNodeExecution,
    trackUserInput,
    trackConditionEvaluation,
    trackApiCall,
    trackWorkflowCompletion,
    
    // KYC tracking functions (now unified)
    trackKycStep,
    trackKycStatus,
    
    // Utility functions
    pushDataLayerEvent,
    getUnifiedAnalytics,
    
    // Legacy compatibility
    getWorkflowAnalytics: getUnifiedAnalytics // Alias for backward compatibility
};