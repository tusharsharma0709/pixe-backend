// controllers/WorkflowController.js - Complete implementation with SurePass integration

const { Workflow } = require('../models/Workflows');
const { Admin } = require('../models/Admins');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const unifiedGtmService = require('../services/gtmTrackingServices');

// SurePass endpoint mapping and validation - UPDATED with new endpoints
const SUREPASS_ENDPOINTS = {
    '/api/verification/aadhaar-v2/generate-otp': {
        name: 'Aadhaar OTP Generation',
        method: 'POST',
        requiredParams: ['aadhaar_number'], // This should match your surepassServices.js
        description: 'Generate OTP for Aadhaar verification using SurePass API'
    },
    '/api/verification/aadhaar-v2/submit-otp': {
        name: 'Aadhaar OTP Verification', 
        method: 'POST',
        requiredParams: ['client_id', 'otp'],
        description: 'Verify Aadhaar OTP using SurePass API'
    },
    '/api/verification/aadhaar': {
        name: 'Direct Aadhaar Verification',
        method: 'POST',
        requiredParams: ['aadhaar_number'],
        description: 'Verify Aadhaar number directly using SurePass API'
    },
    '/api/verification/pan': {
        name: 'PAN Verification',
        method: 'POST', 
        requiredParams: ['pan_number'],
        description: 'Verify PAN number using SurePass API'
    },
    '/api/verification/aadhaar-pan-link': {
        name: 'Aadhaar-PAN Link Check',
        method: 'POST',
        requiredParams: ['aadhaar_number', 'pan_number'], 
        description: 'Check if Aadhaar and PAN are linked'
    },
    '/api/verification/bank-verification': {
        name: 'Bank Account Verification',
        method: 'POST',
        requiredParams: ['account_number', 'ifsc'],
        description: 'Verify bank account using SurePass API'
    },
    '/api/verification/chassis-to-rc-details': {
        name: 'Chassis to RC Details',
        method: 'POST',
        requiredParams: ['chassis_number'],
        description: 'Get RC details by vehicle chassis number using SurePass API'
    },
    '/api/verification/company-details': {
        name: 'Company Details Verification',
        method: 'POST',
        requiredParams: ['cin_number'],
        description: 'Get company details by CIN using SurePass API'
    },
    '/api/verification/din-verification': {
        name: 'DIN Verification',
        method: 'POST',
        requiredParams: ['din_number'],
        description: 'Verify Director Identification Number using SurePass API'
    },
    '/api/verification/fssai': {
        name: 'FSSAI License Verification',
        method: 'POST',
        requiredParams: ['id_number'],
        description: 'Verify FSSAI license details using SurePass API'
    },
    '/api/verification/gstin': {
        name: 'GSTIN Verification',
        method: 'POST',
        requiredParams: ['id_number'],
        description: 'Verify GSTIN details using SurePass API'
    },
    '/api/verification/icai': {
        name: 'ICAI Membership Verification',
        method: 'POST',
        requiredParams: ['membership_number'],
        description: 'Verify ICAI membership details using SurePass API'
    }
};

/**
 * Validate and process SurePass API nodes in workflow
 * @param {Array} nodes - Workflow nodes array
 * @returns {Object} - Validation result and processed nodes
 */
function validateAndProcessSurePassNodes(nodes) {
    const processedNodes = [];
    const surePassNodes = [];
    const validationErrors = [];

    nodes.forEach((node, index) => {
        // Check if this is an API node with SurePass endpoint
        if (node.type === 'api' && node.apiEndpoint) {
            const endpoint = node.apiEndpoint;
            
            // Check if it's a SurePass endpoint
            if (SUREPASS_ENDPOINTS[endpoint]) {
                const endpointConfig = SUREPASS_ENDPOINTS[endpoint];
                
                console.log(`🔍 Found SurePass endpoint in node ${node.nodeId}: ${endpoint}`);
                
                // Validate required parameters - FIXED LOGIC
                const nodeParams = node.apiParams || {};
                const paramKeys = Object.keys(nodeParams);
                const paramValues = Object.values(nodeParams);
                
                // Check if parameters exist (either as direct values or template variables)
                const missingParams = endpointConfig.requiredParams.filter(param => {
                    // Check if the parameter exists as a key
                    const hasDirectParam = nodeParams.hasOwnProperty(param);
                    
                    // Check if any parameter value contains the required variable as template
                    const hasTemplateParam = paramValues.some(value => {
                        if (typeof value === 'string') {
                            // Check for template variables like {{aadhaar_number}}, {{pan_number}}, etc.
                            const templateVarPattern = new RegExp(`{{\\s*(${param}|${param.replace('_', '')}|${param.replace('_', 'Number')}|${param.replace('_number', '')}|${param.replace('id_', '')})\\s*}}`);
                            return templateVarPattern.test(value);
                        }
                        return false;
                    });
                    
                    // For common mappings, check specific patterns
                    let hasValidMapping = false;
                    if (param === 'aadhaar_number') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{aadhaar_number}}') || val.includes('{{aadhaar}}') || val.includes('{{aadhaarNumber}}'))
                        );
                    } else if (param === 'pan_number') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{pan_number}}') || val.includes('{{pan}}') || val.includes('{{panNumber}}'))
                        );
                    } else if (param === 'account_number') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{account_number}}') || val.includes('{{accountNumber}}'))
                        );
                    } else if (param === 'client_id') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{client_id}}') || val.includes('{{clientId}}') || val.includes('{{aadhaarClientId}}'))
                        );
                    } else if (param === 'ifsc') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{ifsc}}') || val.includes('{{ifscCode}}'))
                        );
                    } else if (param === 'otp') {
                        hasValidMapping = paramValues.some(val => 
                            typeof val === 'string' && 
                            (val.includes('{{otp}}') || val.includes('{{aadhaarOtp}}'))
                        );
                    }
                    
                    // Parameter is valid if it exists directly, as template, or has valid mapping
                    return !(hasDirectParam || hasTemplateParam || hasValidMapping);
                });
                
                console.log(`  Validation for ${endpoint}:`);
                console.log(`  Required params: ${endpointConfig.requiredParams.join(', ')}`);
                console.log(`  Node params: ${JSON.stringify(nodeParams)}`);
                console.log(`  Missing params: ${missingParams.join(', ')}`);
                
                if (missingParams.length > 0) {
                    validationErrors.push({
                        nodeId: node.nodeId,
                        endpoint: endpoint,
                        missingParams: missingParams,
                        message: `Node ${node.nodeId} missing required parameters: ${missingParams.join(', ')}. Make sure to use template variables like {{aadhaar_number}}, {{pan_number}}, etc.`
                    });
                }
                
                // Set default HTTP method if not specified
                if (!node.apiMethod) {
                    node.apiMethod = endpointConfig.method;
                }
                
                // Add enhanced metadata for SurePass nodes
                node.surePassConfig = {
                    endpointName: endpointConfig.name,
                    description: endpointConfig.description,
                    isKycVerification: true,
                    verificationStep: endpoint.split('/').pop(), // Extract step name
                    requiredParams: endpointConfig.requiredParams
                };
                
                surePassNodes.push({
                    nodeId: node.nodeId,
                    nodeName: node.name,
                    endpoint: endpoint,
                    config: endpointConfig
                });
            }
        }
        
        processedNodes.push(node);
    });

    return {
        nodes: processedNodes,
        surePassNodes: surePassNodes,
        validationErrors: validationErrors,
        hasSurePassNodes: surePassNodes.length > 0
    };
}

const WorkflowController = {
    // Create workflow with SurePass endpoint processing
    createWorkflow: async (req, res) => {
        try {
            const {
                name,
                description,
                category,
                tags,
                nodes,
                startNodeId,
                isActive,
                metadata
            } = req.body;

            const adminId = req.adminId;

            // Validate required fields
            if (!name || !nodes || !startNodeId) {
                return res.status(400).json({
                    success: false,
                    message: "Name, nodes, and startNodeId are required"
                });
            }

            // Validate startNodeId exists in nodes
            const startNodeExists = nodes.some(node => node.nodeId === startNodeId);
            if (!startNodeExists) {
                return res.status(400).json({
                    success: false,
                    message: "startNodeId must reference an existing node"
                });
            }

            // PROCESS SUREPASS NODES: Validate and enhance SurePass API nodes
            const surePassProcessing = validateAndProcessSurePassNodes(nodes);
            
            // Return validation errors for SurePass nodes if any
            if (surePassProcessing.validationErrors.length > 0) {
                console.log('❌ SurePass node validation errors:', surePassProcessing.validationErrors);
                return res.status(400).json({
                    success: false,
                    message: "SurePass endpoint validation failed",
                    errors: surePassProcessing.validationErrors
                });
            }

            // Create the workflow with processed nodes
            const workflow = new Workflow({
                name,
                description,
                category: category || 'general',
                tags: tags || [],
                nodes: surePassProcessing.nodes, // Use processed nodes
                startNodeId,
                adminId,
                isActive: isActive !== undefined ? isActive : true,
                metadata: {
                    ...metadata,
                    hasSurePassIntegration: surePassProcessing.hasSurePassNodes,
                    surePassEndpoints: surePassProcessing.surePassNodes.map(n => n.endpoint),
                    totalNodes: surePassProcessing.nodes.length,
                    surePassNodeCount: surePassProcessing.surePassNodes.length
                }
            });

            await workflow.save();

            // Get admin details
            const admin = await Admin.findById(adminId);

            // AUTOMATIC TRACKING: Track workflow creation with SurePass info
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_created',
                    event_category: 'workflow_management',
                    workflow_id: workflow._id,
                    workflow_name: workflow.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        workflow_category: workflow.category,
                        workflow_tags: workflow.tags,
                        total_nodes: workflow.nodes.length,
                        node_types: [...new Set(workflow.nodes.map(n => n.type))],
                        has_surepass_integration: surePassProcessing.hasSurePassNodes,
                        surepass_endpoints: surePassProcessing.surePassNodes.map(n => n.endpoint),
                        surepass_verification_steps: surePassProcessing.surePassNodes.map(n => n.config.name),
                        created_by: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin',
                        is_kyc_workflow: surePassProcessing.hasSurePassNodes
                    }
                });

                console.log(`✅ Tracked workflow creation with SurePass integration: ${workflow.name}`);
                
                // If SurePass nodes detected, log specific details
                if (surePassProcessing.hasSurePassNodes) {
                    console.log(`🔐 SurePass Integration Details:`);
                    surePassProcessing.surePassNodes.forEach(node => {
                        console.log(`   - Node: ${node.nodeId} | Endpoint: ${node.endpoint} | Type: ${node.config.name}`);
                    });
                }
            } catch (trackingError) {
                console.error('❌ Error tracking workflow creation:', trackingError);
            }

            // SETUP SUREPASS MONITORING: If workflow has SurePass nodes
            if (surePassProcessing.hasSurePassNodes) {
                try {
                    // Pre-validate SurePass configuration
                    const surePassConfig = {
                        apiKey: process.env.SUREPASS_API_KEY,
                        apiUrl: process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io/api/v1',
                        testMode: process.env.BANK_TEST_MODE === 'true'
                    };

                    if (!surePassConfig.apiKey) {
                        console.warn('⚠️ SUREPASS_API_KEY not configured - SurePass verification may fail');
                        
                        // Create a notification for admin about missing configuration
                        await Notification.create({
                            title: "SurePass Configuration Warning",
                            description: `Your workflow "${workflow.name}" includes SurePass verification but API key is not configured. Please configure SUREPASS_API_KEY in environment variables.`,
                            type: 'configuration_warning',
                            priority: 'high',
                            forAdmin: adminId,
                            relatedTo: {
                                model: 'Workflow',
                                id: workflow._id
                            }
                        });
                    } else {
                        console.log(`✅ SurePass configuration validated for workflow: ${workflow.name}`);
                    }

                } catch (configError) {
                    console.error('❌ Error validating SurePass configuration:', configError);
                }
            }

            // Log admin activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: surePassProcessing.hasSurePassNodes ? 'workflow_created' : 'workflow_created',
                entityType: 'Workflow',
                entityId: workflow._id,
                description: `Created ${surePassProcessing.hasSurePassNodes ? 'KYC ' : ''}workflow: ${workflow.name}${surePassProcessing.hasSurePassNodes ? ` with ${surePassProcessing.surePassNodes.length} SurePass verification steps` : ''}`,
                adminId: adminId
            });

            // Create success notification
            const notificationMessage = surePassProcessing.hasSurePassNodes 
                ? `Your KYC workflow "${workflow.name}" has been created with ${surePassProcessing.surePassNodes.length} SurePass verification steps.`
                : `Your workflow "${workflow.name}" has been created successfully.`;

            await Notification.create({
                title: "Workflow Created Successfully",
                description: notificationMessage,
                type: surePassProcessing.hasSurePassNodes ? 'workflow_created' : 'workflow_created',
                priority: 'low',
                forAdmin: adminId,
                relatedTo: {
                    model: 'Workflow',
                    id: workflow._id
                },
                actionUrl: `/workflows/${workflow._id}`
            });

            return res.status(201).json({
                success: true,
                message: "Workflow created successfully",
                data: {
                    workflow,
                    surePassIntegration: {
                        enabled: surePassProcessing.hasSurePassNodes,
                        endpointCount: surePassProcessing.surePassNodes.length,
                        endpoints: surePassProcessing.surePassNodes.map(n => ({
                            nodeId: n.nodeId,
                            endpoint: n.endpoint,
                            name: n.config.name
                        }))
                    }
                }
            });

        } catch (error) {
            console.error("Error creating workflow:", error);

            // Track workflow creation failure
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_creation_failed',
                    event_category: 'workflow_management',
                    user_id: req.adminId,
                    success: false,
                    error_message: error.message,
                    metadata: {
                        attempted_workflow_name: req.body.name || 'Unknown',
                        error_type: error.name || 'UnknownError',
                        had_surepass_nodes: req.body.nodes ? 
                            req.body.nodes.some(n => n.type === 'api' && n.apiEndpoint && SUREPASS_ENDPOINTS[n.apiEndpoint]) : false
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow creation failure:', trackingError);
            }

            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update workflow with enhanced tracking
    updateWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const updateData = req.body;

            // Find the workflow
            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Store original data for tracking changes
            const originalData = {
                name: workflow.name,
                category: workflow.category,
                isActive: workflow.isActive,
                nodeCount: workflow.nodes.length,
                hasSurePassIntegration: workflow.metadata?.hasSurePassIntegration || false
            };

            // Process SurePass nodes if nodes are being updated
            let surePassProcessing = null;
            if (updateData.nodes) {
                surePassProcessing = validateAndProcessSurePassNodes(updateData.nodes);
                
                // Return validation errors if any
                if (surePassProcessing.validationErrors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "SurePass endpoint validation failed",
                        errors: surePassProcessing.validationErrors
                    });
                }
                
                // Use processed nodes
                updateData.nodes = surePassProcessing.nodes;
                
                // Update metadata with SurePass info
                updateData.metadata = {
                    ...updateData.metadata,
                    hasSurePassIntegration: surePassProcessing.hasSurePassNodes,
                    surePassEndpoints: surePassProcessing.surePassNodes.map(n => n.endpoint),
                    surePassNodeCount: surePassProcessing.surePassNodes.length
                };
            }

            // Update the workflow
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    workflow[key] = updateData[key];
                }
            });

            await workflow.save();

            // Get admin details
            const admin = await Admin.findById(adminId);
            // AUTOMATIC TRACKING: Track workflow update
            try {
                // Determine what changed
                const changes = [];
                if (originalData.name !== workflow.name) changes.push('name');
                if (originalData.category !== workflow.category) changes.push('category');
                if (originalData.isActive !== workflow.isActive) changes.push('status');
                if (originalData.nodeCount !== workflow.nodes.length) changes.push('nodes');
                if (surePassProcessing && (originalData.hasSurePassIntegration !== surePassProcessing.hasSurePassNodes)) {
                    changes.push('surepass_integration');
                }

                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_updated',
                    event_category: 'workflow_management',
                    workflow_id: workflow._id,
                    workflow_name: workflow.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        changes_made: changes,
                        previous_name: originalData.name,
                        current_name: workflow.name,
                        previous_status: originalData.isActive ? 'active' : 'inactive',
                        current_status: workflow.isActive ? 'active' : 'inactive',
                        total_nodes: workflow.nodes.length,
                        has_surepass_integration: workflow.metadata?.hasSurePassIntegration || false,
                        surepass_endpoints: workflow.metadata?.surePassEndpoints || [],
                        updated_by: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin'
                    }
                });

                console.log(`✅ Automatically tracked workflow update: ${workflow.name}`);
            } catch (trackingError) {
                console.error('❌ Error tracking workflow update:', trackingError);
            }

            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_updated',
                entityType: 'Workflow',
                entityId: workflow._id,
                description: `Updated workflow: ${workflow.name}`,
                adminId: adminId
            });

            return res.status(200).json({
                success: true,
                message: "Workflow updated successfully",
                data: {
                    workflow,
                    surePassIntegration: surePassProcessing ? {
                        enabled: surePassProcessing.hasSurePassNodes,
                        endpointCount: surePassProcessing.surePassNodes.length,
                        endpoints: surePassProcessing.surePassNodes.map(n => ({
                            nodeId: n.nodeId,
                            endpoint: n.endpoint,
                            name: n.config.name
                        }))
                    } : null
                }
            });

        } catch (error) {
            console.error("Error updating workflow:", error);

            // Track workflow update failure
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_update_failed',
                    event_category: 'workflow_management',
                    workflow_id: req.params.id,
                    user_id: req.adminId,
                    success: false,
                    error_message: error.message,
                    metadata: {
                        error_type: error.name || 'UnknownError'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow update failure:', trackingError);
            }

            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflows with enhanced filtering
    getWorkflows: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { 
                category, 
                isActive, 
                hasSurePassIntegration,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };
            
            if (category) query.category = category;
            if (isActive !== undefined) query.isActive = isActive === 'true';
            if (hasSurePassIntegration !== undefined) {
                query['metadata.hasSurePassIntegration'] = hasSurePassIntegration === 'true';
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Workflow.countDocuments(query);

            // Execute query
            const workflows = await Workflow.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .select('-nodes'); // Exclude nodes for list view

            return res.status(200).json({
                success: true,
                data: {
                    workflows,
                    pagination: {
                        totalRecords: totalCount,
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error("Error getting workflows:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get single workflow with full details
    getWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Analyze SurePass integration
            const surePassAnalysis = validateAndProcessSurePassNodes(workflow.nodes);

            return res.status(200).json({
                success: true,
                data: {
                    workflow,
                    surePassIntegration: {
                        enabled: surePassAnalysis.hasSurePassNodes,
                        endpointCount: surePassAnalysis.surePassNodes.length,
                        endpoints: surePassAnalysis.surePassNodes.map(n => ({
                            nodeId: n.nodeId,
                            endpoint: n.endpoint,
                            name: n.config.name,
                            description: n.config.description
                        })),
                        validationErrors: surePassAnalysis.validationErrors
                    }
                }
            });

        } catch (error) {
            console.error("Error getting workflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete workflow with tracking
    deleteWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check if workflow is being used in active sessions
            const { UserSession } = require('../models/UserSessions');
            const activeSessionsCount = await UserSession.countDocuments({
                workflowId: id,
                status: 'active'
            });

            if (activeSessionsCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete workflow. It has ${activeSessionsCount} active sessions.`
                });
            }

            // Store workflow info for tracking
            const workflowInfo = {
                name: workflow.name,
                category: workflow.category,
                totalNodes: workflow.nodes.length,
                hasSurePassIntegration: workflow.metadata?.hasSurePassIntegration || false,
                surePassEndpoints: workflow.metadata?.surePassEndpoints || []
            };

            await workflow.deleteOne();

            // Get admin details
            const admin = await Admin.findById(adminId);

            // Track workflow deletion
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_deleted',
                    event_category: 'workflow_management',
                    workflow_id: id,
                    workflow_name: workflowInfo.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        ...workflowInfo,
                        deleted_by: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow deletion:', trackingError);
            }

            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_deleted',
                entityType: 'Workflow',
                entityId: id,
                description: `Deleted workflow: ${workflowInfo.name}`,
                adminId: adminId
            });

            return res.status(200).json({
                success: true,
                message: "Workflow deleted successfully"
            });

        } catch (error) {
            console.error("Error deleting workflow:", error);

            // Track workflow deletion failure
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_deletion_failed',
                    event_category: 'workflow_management',
                    workflow_id: req.params.id,
                    user_id: req.adminId,
                    success: false,
                    error_message: error.message
                });
            } catch (trackingError) {
                console.error('Error tracking workflow deletion failure:', trackingError);
            }

            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get admin workflows (enhanced with SurePass filtering) - matches your route
    getAdminWorkflows: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { 
                category, 
                isActive, 
                hasSurePassIntegration,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };
            
            if (category) query.category = category;
            if (isActive !== undefined) query.isActive = isActive === 'true';
            if (hasSurePassIntegration !== undefined) {
                query['metadata.hasSurePassIntegration'] = hasSurePassIntegration === 'true';
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Workflow.countDocuments(query);

            // Execute query
            const workflows = await Workflow.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .select('-nodes'); // Exclude nodes for list view

            // Add SurePass integration summary for each workflow
            const workflowsWithSurePassInfo = workflows.map(workflow => {
                const workflowObj = workflow.toObject();
                workflowObj.surePassSummary = {
                    hasIntegration: workflow.metadata?.hasSurePassIntegration || false,
                    endpointCount: workflow.metadata?.surePassNodeCount || 0,
                    endpoints: workflow.metadata?.surePassEndpoints || []
                };
                return workflowObj;
            });

            return res.status(200).json({
                success: true,
                data: {
                    workflows: workflowsWithSurePassInfo,
                    pagination: {
                        totalRecords: totalCount,
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error("Error getting admin workflows:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflow templates
    getWorkflowTemplates: async (req, res) => {
        try {
            // You can create pre-defined templates here or fetch from database
            const templates = [
                {
                    id: 'kyc_basic',
                    name: 'Basic KYC Verification',
                    description: 'Complete KYC workflow with Aadhaar, PAN, and Bank verification',
                    category: 'kyc',
                    hasSurePassIntegration: true,
                    surePassEndpoints: [
                        '/api/verification/aadhaar',
                        '/api/verification/pan',
                        '/api/verification/bank-account'
                    ],
                    estimatedNodes: 12
                },
                {
                    id: 'property_sales',
                    name: 'Property Sales Workflow',
                    description: 'Guide customers through property information and booking',
                    category: 'sales',
                    hasSurePassIntegration: false,
                    surePassEndpoints: [],
                    estimatedNodes: 8
                },
                {
                    id: 'loan_application',
                    name: 'Loan Application Process',
                    description: 'Complete loan application with KYC verification',
                    category: 'finance',
                    hasSurePassIntegration: true,
                    surePassEndpoints: [
                        '/api/verification/aadhaar',
                        '/api/verification/pan',
                        '/api/verification/aadhaar-pan-link'
                    ],
                    estimatedNodes: 15
                }
            ];

            return res.status(200).json({
                success: true,
                data: {
                    templates,
                    availableSurePassEndpoints: Object.keys(SUREPASS_ENDPOINTS)
                }
            });

        } catch (error) {
            console.error("Error getting workflow templates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    // Get available SurePass endpoints (helper for frontend)
    getSurePassEndpoints: async (req, res) => {
        try {
            const endpoints = Object.keys(SUREPASS_ENDPOINTS).map(endpoint => ({
                endpoint,
                ...SUREPASS_ENDPOINTS[endpoint]
            }));

            return res.status(200).json({
                success: true,
                data: {
                    endpoints,
                    totalEndpoints: endpoints.length,
                    configured: !!process.env.SUREPASS_API_KEY,
                    apiUrl: process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io/api/v1',
                    testMode: process.env.BANK_TEST_MODE === 'true'
                }
            });
        } catch (error) {
            console.error("Error getting SurePass endpoints:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Validate SurePass node configuration (helper endpoint)
    validateSurePassNode: async (req, res) => {
        try {
            const { apiEndpoint, apiParams, nodeId } = req.body;

            if (!apiEndpoint) {
                return res.status(400).json({
                    success: false,
                    message: "apiEndpoint is required"
                });
            }

            const endpointConfig = SUREPASS_ENDPOINTS[apiEndpoint];
            if (!endpointConfig) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid SurePass endpoint",
                    availableEndpoints: Object.keys(SUREPASS_ENDPOINTS)
                });
            }

            // Validate parameters
            const nodeParams = apiParams || {};
            const missingParams = endpointConfig.requiredParams.filter(param => 
                !nodeParams[param] && 
                !nodeParams[param.replace('_', '')] &&
                !nodeParams[param.replace('_', 'Number')]
            );

            const isValid = missingParams.length === 0;

            // Suggest parameter mapping if needed
            const parameterSuggestions = {};
            if (!isValid) {
                endpointConfig.requiredParams.forEach(param => {
                    parameterSuggestions[param] = {
                        examples: [
                            `{{${param}}}`,
                            `{{${param.replace('_', '')}}}`,
                            `{{${param.replace('_', 'Number')}}}`,
                            `{{user_${param}}}`
                        ],
                        description: `Parameter for ${param.replace('_', ' ')}`
                    };
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    nodeId,
                    endpoint: apiEndpoint,
                    endpointName: endpointConfig.name,
                    isValid,
                    missingParams,
                    requiredParams: endpointConfig.requiredParams,
                    description: endpointConfig.description,
                    method: endpointConfig.method,
                    parameterSuggestions: !isValid ? parameterSuggestions : null
                }
            });

        } catch (error) {
            console.error("Error validating SurePass node:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Clone workflow
    cloneWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const { name: newName } = req.body;

            // Find the workflow to clone
            const originalWorkflow = await Workflow.findOne({ _id: id, adminId });

            if (!originalWorkflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Create cloned workflow
            const clonedWorkflow = new Workflow({
                name: newName || `${originalWorkflow.name} (Copy)`,
                description: originalWorkflow.description,
                category: originalWorkflow.category,
                tags: [...originalWorkflow.tags],
                nodes: originalWorkflow.nodes.map(node => ({ ...node })), // Deep copy nodes
                startNodeId: originalWorkflow.startNodeId,
                adminId,
                isActive: false, // Start as inactive
                metadata: { ...originalWorkflow.metadata }
            });

            await clonedWorkflow.save();

            // Get admin details
            const admin = await Admin.findById(adminId);

            // Track workflow cloning
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_cloned',
                    event_category: 'workflow_management',
                    workflow_id: clonedWorkflow._id,
                    workflow_name: clonedWorkflow.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        original_workflow_id: originalWorkflow._id,
                        original_workflow_name: originalWorkflow.name,
                        has_surepass_integration: clonedWorkflow.metadata?.hasSurePassIntegration || false,
                        cloned_by: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow cloning:', trackingError);
            }

            return res.status(201).json({
                success: true,
                message: "Workflow cloned successfully",
                data: clonedWorkflow
            });

        } catch (error) {
            console.error("Error cloning workflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Test workflow with sample data
    testWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const { testData = {} } = req.body;

            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Validate workflow structure
            const validation = validateAndProcessSurePassNodes(workflow.nodes);
            
            // Check for validation errors
            if (validation.validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Workflow validation failed",
                    errors: validation.validationErrors
                });
            }

            // Simulate workflow execution
            const testResult = {
                workflow_id: workflow._id,
                workflow_name: workflow.name,
                test_status: 'success',
                total_nodes: workflow.nodes.length,
                surepass_integration: {
                    enabled: validation.hasSurePassNodes,
                    endpoints: validation.surePassNodes.map(n => n.endpoint)
                },
                node_validations: [],
                estimated_execution_path: []
            };

            // Validate each node
            workflow.nodes.forEach((node, index) => {
                const nodeValidation = {
                    node_id: node.nodeId,
                    node_name: node.name,
                    node_type: node.type,
                    status: 'valid',
                    issues: []
                };

                // Check for common issues
                if (node.type === 'condition' && !node.condition) {
                    nodeValidation.status = 'error';
                    nodeValidation.issues.push('Missing condition expression');
                }

                if (node.type === 'api' && !node.apiEndpoint) {
                    nodeValidation.status = 'error';
                    nodeValidation.issues.push('Missing API endpoint');
                }

                if ((node.type === 'input' || node.type === 'interactive') && !node.variableName) {
                    nodeValidation.status = 'warning';
                    nodeValidation.issues.push('Missing variable name');
                }

                testResult.node_validations.push(nodeValidation);
            });

            // Track workflow test
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_tested',
                    event_category: 'workflow_management',
                    workflow_id: workflow._id,
                    workflow_name: workflow.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        test_result: testResult.test_status,
                        validation_errors: validation.validationErrors.length,
                        has_surepass_integration: validation.hasSurePassNodes
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow test:', trackingError);
            }

            return res.status(200).json({
                success: true,
                message: "Workflow test completed",
                data: testResult
            });

        } catch (error) {
            console.error("Error testing workflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflow analytics (enhanced with unified analytics)
    getWorkflowAnalytics: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const { startDate, endDate } = req.query;

            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Get unified analytics
            const analytics = await unifiedGtmService.getUnifiedAnalytics(id, startDate, endDate);

            if (!analytics) {
                return res.status(404).json({
                    success: false,
                    message: "No analytics data found for this workflow"
                });
            }

            // Enhanced analytics with SurePass info
            const enhancedAnalytics = {
                workflow_info: {
                    id: workflow._id,
                    name: workflow.name,
                    category: workflow.category,
                    has_surepass_integration: workflow.metadata?.hasSurePassIntegration || false,
                    surepass_endpoints: workflow.metadata?.surePassEndpoints || []
                },
                analytics,
                date_range: { startDate, endDate }
            };

            return res.status(200).json({
                success: true,
                data: enhancedAnalytics
            });

        } catch (error) {
            console.error("Error getting workflow analytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    /**
     * Preview workflow execution with sample data
     */
    previewWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const { sampleData = {}, startFromNodeId } = req.body;
            const adminId = req.adminId;

            const workflow = await Workflow.findOne({ _id: id, adminId });

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Import the preview service
            const { previewWorkflowExecution } = require('../services/workflowExecutor');

            // Preview the workflow execution
            const previewResult = await previewWorkflowExecution(
                workflow, 
                sampleData, 
                startFromNodeId || workflow.startNodeId
            );

            // Track workflow preview
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'workflow_previewed',
                    event_category: 'workflow_management',
                    workflow_id: workflow._id,
                    workflow_name: workflow.name,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        preview_mode: true,
                        sample_data_provided: Object.keys(sampleData).length > 0,
                        start_node_id: startFromNodeId || workflow.startNodeId,
                        execution_path_length: previewResult.executionPath?.length || 0
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking workflow preview:', trackingError);
            }

            return res.status(200).json({
                success: true,
                message: "Workflow preview generated successfully",
                data: previewResult
            });

        } catch (error) {
            console.error("Error previewing workflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = WorkflowController;