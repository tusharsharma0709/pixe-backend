// services/kycGtmService.js
const gtmService = require('./gtmServices');
const { broadcastTrackingEvent } = require('./trackingEventEmitters');
const mongoose = require('mongoose');

// Default GTM configuration from env variables
const DEFAULT_ACCOUNT_ID = process.env.GTM_ACCOUNT_ID;
const DEFAULT_CONTAINER_ID = process.env.GTM_CONTAINER_ID;
const DEFAULT_WORKSPACE_ID = process.env.GTM_WORKSPACE_ID || 'default';

// MongoDB model for tracking events
const TrackingEventSchema = new mongoose.Schema({
    event: String,
    workflow_id: mongoose.Schema.Types.ObjectId,
    user_id: mongoose.Schema.Types.ObjectId,
    session_id: mongoose.Schema.Types.ObjectId,
    workflow_node_id: String,
    step: String,
    success: Boolean,
    completion_percentage: Number,
    timestamp: { type: Date, default: Date.now },
    data: mongoose.Schema.Types.Mixed
}, { 
    timestamps: true 
});

// Create model if it doesn't exist
const TrackingEvent = mongoose.models.TrackingEvents || 
                       mongoose.model('TrackingEvents', TrackingEventSchema);

/**
 * Track KYC verification step in GTM
 * @param {Object} user - User object
 * @param {string} step - KYC verification step (aadhaar, pan, etc.)
 * @param {boolean} isCompleted - Whether the step was completed successfully
 * @returns {Promise<Object>} - Result of tracking operation
 */
async function trackKycStep(user, step, isCompleted = true) {
    try {
        if (!user || !user._id) {
            console.error('Invalid user provided for KYC tracking');
            return { success: false, message: 'Invalid user' };
        }

        // Clean step name
        const cleanStep = step.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        
        // Create tracking event in the database
        const trackingEvent = new TrackingEvent({
            event: 'kyc_verification',
            user_id: user._id,
            step: cleanStep,
            success: isCompleted,
            data: {
                user_name: user.name,
                user_phone: user.phone,
                step: cleanStep,
                success: isCompleted,
                timestamp: new Date().toISOString()
            }
        });
        
        await trackingEvent.save();
        
        // Broadcast the event to WebSocket clients
        broadcastTrackingEvent({
            event: 'kyc_verification',
            user_id: user._id.toString(),
            step: cleanStep,
            success: isCompleted,
            timestamp: new Date().toISOString()
        });
        
        // Create GTM tag if GTM credentials are available
        if (DEFAULT_ACCOUNT_ID && DEFAULT_CONTAINER_ID) {
            try {
                // Attempt to create or update tag in GTM
                await updateKycStepTag(cleanStep, user._id.toString(), isCompleted);
            } catch (gtmError) {
                console.error('Error updating GTM tag:', gtmError);
                // Non-blocking - continue despite GTM API errors
            }
        }

        console.log(`✅ Tracked KYC step ${cleanStep} for user ${user._id} (completed: ${isCompleted})`);
        return { success: true, step: cleanStep, completed: isCompleted };
    } catch (error) {
        console.error('Error tracking KYC step:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Track overall KYC status 
 * @param {Object} user - User object
 * @param {Object} kycStatus - KYC status object with verification statuses
 * @returns {Promise<Object>} - Result of tracking operation
 */
async function trackKycStatus(user, kycStatus) {
    try {
        if (!user || !user._id) {
            console.error('Invalid user provided for KYC status tracking');
            return { success: false, message: 'Invalid user' };
        }
        
        // Calculate completion percentage
        const steps = Object.keys(kycStatus).filter(k => k.startsWith('is'));
        const completedSteps = steps.filter(step => kycStatus[step] === true).length;
        const completionPercentage = Math.round((completedSteps / steps.length) * 100);
        
        // Create tracking event
        const trackingEvent = new TrackingEvent({
            event: 'kyc_status_updated',
            user_id: user._id,
            completion_percentage: completionPercentage,
            data: {
                ...kycStatus,
                user_name: user.name,
                user_phone: user.phone,
                completion_percentage: completionPercentage,
                completed_steps: completedSteps,
                total_steps: steps.length,
                timestamp: new Date().toISOString()
            }
        });
        
        await trackingEvent.save();
        
        // Broadcast the event
        broadcastTrackingEvent({
            event: 'kyc_status_updated',
            user_id: user._id.toString(),
            ...kycStatus,
            completion_percentage: completionPercentage,
            completed_steps: completedSteps,
            total_steps: steps.length,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Tracked KYC status for user ${user._id} (completion: ${completionPercentage}%)`);
        return { 
            success: true, 
            completion_percentage: completionPercentage,
            completed_steps: completedSteps,
            total_steps: steps.length
        };
    } catch (error) {
        console.error('Error tracking KYC status:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Push event to dataLayer via WebSocket
 * @param {Object} session - User session
 * @param {string} eventName - Event name
 * @param {Object} eventData - Event data
 */
function pushDataLayerEvent(session, eventName, eventData = {}) {
    try {
        // Create event payload
        const payload = {
            event: eventName,
            session_id: session._id.toString(),
            user_id: session.userId.toString(),
            timestamp: new Date().toISOString(),
            ...eventData
        };
        
        // Broadcast the event
        broadcastTrackingEvent(payload);
        
        console.log(`✅ Pushed dataLayer event: ${eventName}`);
        return true;
    } catch (error) {
        console.error('Error pushing dataLayer event:', error);
        return false;
    }
}

/**
 * Create or update GTM tag for KYC step
 * @param {string} kycStep - KYC step name
 * @param {string} userId - User ID
 * @param {boolean} isCompleted - Whether step is completed
 * @private
 */
async function updateKycStepTag(kycStep, userId, isCompleted = false) {
    try {
        // Get GTM configuration
        const accountId = DEFAULT_ACCOUNT_ID;
        const containerId = DEFAULT_CONTAINER_ID;
        const workspaceId = DEFAULT_WORKSPACE_ID;
        
        if (!accountId || !containerId) {
            return false;
        }
        
        // Tag configuration for GA4
        const tagData = {
            name: `KYC_${kycStep.toUpperCase()}_TAG`,
            type: 'gaawe', // GA4 event
            parameter: [
                {
                    key: 'eventName',
                    type: 'template',
                    value: `kyc_${kycStep}_verification`
                },
                {
                    key: 'eventParameters',
                    type: 'list',
                    list: [
                        {
                            type: 'map',
                            map: [
                                {
                                    key: 'name',
                                    type: 'template',
                                    value: 'user_id'
                                },
                                {
                                    key: 'value',
                                    type: 'template',
                                    value: userId
                                }
                            ]
                        },
                        {
                            type: 'map',
                            map: [
                                {
                                    key: 'name',
                                    type: 'template',
                                    value: 'completed'
                                },
                                {
                                    key: 'value',
                                    type: 'template',
                                    value: isCompleted ? 'true' : 'false'
                                }
                            ]
                        }
                    ]
                }
            ],
            firingTriggerId: ['ALL_PAGES']
        };
        
        // Find existing tag or create new one
        const tags = await gtmService.getTags(accountId, containerId, workspaceId);
        const existingTag = tags.find(tag => tag.name === tagData.name);
        
        if (existingTag) {
            // Update existing tag
            await gtmService.updateTag(
                accountId, 
                containerId, 
                workspaceId, 
                existingTag.tagId, 
                {
                    ...existingTag,
                    ...tagData
                }
            );
        } else {
            // Create new tag
            await gtmService.createTag(
                accountId,
                containerId,
                workspaceId,
                tagData
            );
        }
        
        return true;
    } catch (error) {
        console.error('Error updating KYC GTM tag:', error);
        return false;
    }
}

/**
 * Set up KYC GTM components
 * @returns {Promise<boolean>}
 */
async function setupKycGtmComponents() {
    try {
        // Create necessary GTM components if not exist
        const accountId = process.env.DEFAULT_ACCOUNT_ID;
        const containerId = process.env.DEFAULT_CONTAINER_ID;
        
        if (!accountId || !containerId) {
            console.log('GTM configuration missing. KYC tracking in GTM will be disabled.');
            return false;
        }
        
        // Get or create KYC workspace
        const workspaces = await gtmService.getWorkspaces(accountId, containerId);
        let workspace = workspaces.find(w => w.name === 'KYC_Tracking');
        
        if (!workspace) {
            workspace = await gtmService.createWorkspace(accountId, containerId, {
                name: 'KYC_Tracking',
                description: 'Workspace for KYC verification tracking'
            });
            console.log('✅ Created KYC tracking workspace in GTM');
        }
        
        // Update default workspace ID
        process.env.GTM_WORKSPACE_ID = workspace.workspaceId;
        
        // Now create a trigger for KYC events if needed
        const triggers = await gtmService.getTriggers(accountId, containerId, workspace.workspaceId);
        if (!triggers.find(t => t.name === 'KYC_EVENT_TRIGGER')) {
            await gtmService.createTrigger(accountId, containerId, workspace.workspaceId, {
                name: 'KYC_EVENT_TRIGGER',
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
                                value: 'kyc_verification'
                            }
                        ]
                    }
                ]
            });
            console.log('✅ Created KYC event trigger in GTM');
        }
        
        return true;
    } catch (error) {
        console.error('Error setting up KYC GTM components:', error);
        throw error;
    }
}

/**
 * Get KYC verification status from tracking events
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Verification status
 */
async function getKycTrackingStatus(userId) {
    try {
        // Get tracking events for user
        const events = await TrackingEvent.find({ 
            user_id: userId,
            event: { $in: ['kyc_verification', 'kyc_status_updated'] }
        }).sort({ createdAt: -1 }).limit(100);
        
        // Initialize status object
        const status = {
            aadhaar: false,
            aadhaar_otp: false,
            pan: false,
            aadhaar_pan_link: false,
            bank_account: false,
            overall: false,
            completion_percentage: 0
        };
        
        // Extract status from events
        events.forEach(event => {
            if (event.event === 'kyc_verification' && event.step && event.success) {
                status[event.step] = true;
            }
            
            if (event.event === 'kyc_status_updated' && event.completion_percentage) {
                status.completion_percentage = Math.max(
                    status.completion_percentage, 
                    event.completion_percentage
                );
            }
        });
        
        // Calculate overall status
        const steps = Object.keys(status).filter(k => k !== 'overall' && k !== 'completion_percentage');
        const completedSteps = steps.filter(step => status[step]).length;
        status.overall = completedSteps === steps.length;
        
        if (!status.completion_percentage) {
            status.completion_percentage = Math.round((completedSteps / steps.length) * 100);
        }
        
        return status;
    } catch (error) {
        console.error('Error getting KYC tracking status:', error);
        return null;
    }
}

module.exports = {
    trackKycStep,
    trackKycStatus,
    pushDataLayerEvent,
    setupKycGtmComponents,
    getKycTrackingStatus
};