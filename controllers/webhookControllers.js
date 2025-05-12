// controllers/WebhookController.js
const { Webhook } = require('../models/Webhooks');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const crypto = require('crypto');
const axios = require('axios');

const WebhookController = {
    // Get all webhooks
    getAllWebhooks: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { status, isActive, page = 1, limit = 10 } = req.query;
            
            let query = {};
            
            // Role-based access
            if (userType === 'superadmin') {
                // Super admin can see all webhooks
                if (req.query.adminId) {
                    query.adminId = req.query.adminId;
                }
            } else if (userType === 'admin') {
                query.adminId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view webhooks'
                });
            }
            
            // Apply filters
            if (status) query.status = status;
            if (isActive !== undefined) query.isActive = isActive === 'true';
            
            const skip = (page - 1) * limit;
            
            const webhooks = await Webhook.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('adminId', 'first_name last_name email_id')
                .populate('superAdminId', 'first_name last_name email_id');
                
            const total = await Webhook.countDocuments(query);
            
            return res.status(200).json({
                success: true,
                data: {
                    webhooks,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error("Error in getAllWebhooks:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get webhook by ID
    getWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const webhook = await Webhook.findById(id)
                .populate('adminId', 'first_name last_name email_id')
                .populate('superAdminId', 'first_name last_name email_id');
                
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this webhook'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    webhook
                }
            });
        } catch (error) {
            console.error("Error in getWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Create new webhook
    createWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const webhookData = req.body;
            
            // Validate required fields
            if (!webhookData.name || !webhookData.url || !webhookData.events || webhookData.events.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, URL, and events are required'
                });
            }
            
            // Set creator based on user type
            if (userType === 'superadmin') {
                webhookData.superAdminId = userId;
                webhookData.createdBy = { id: userId, role: 'superadmin' };
            } else if (userType === 'admin') {
                webhookData.adminId = userId;
                webhookData.createdBy = { id: userId, role: 'admin' };
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to create webhooks'
                });
            }
            
            // Generate secret if not provided
            if (!webhookData.secret) {
                webhookData.secret = crypto.randomBytes(32).toString('hex');
            }
            
            const webhook = await Webhook.create(webhookData);
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
                action: 'custom',
                entityType: 'Other',
                entityId: webhook._id,
                description: `Created webhook: ${webhook.name}`,
                status: 'success'
            });
            
            return res.status(201).json({
                success: true,
                data: {
                    webhook
                }
            });
        } catch (error) {
            console.error("Error in createWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Update webhook
    updateWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const updateData = req.body;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this webhook'
                });
            }
            
            // Update webhook fields
            Object.assign(webhook, updateData);
            
            await webhook.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
                action: 'custom',
                entityType: 'Other',
                entityId: webhook._id,
                description: `Updated webhook: ${webhook.name}`,
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    webhook
                }
            });
        } catch (error) {
            console.error("Error in updateWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Toggle webhook status
    toggleWebhookStatus: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this webhook'
                });
            }
            
            webhook.isActive = !webhook.isActive;
            webhook.status = webhook.isActive ? 'active' : 'inactive';
            
            await webhook.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
                action: 'custom',
                entityType: 'Other',
                entityId: webhook._id,
                description: `${webhook.isActive ? 'Activated' : 'Deactivated'} webhook: ${webhook.name}`,
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    webhook
                }
            });
        } catch (error) {
            console.error("Error in toggleWebhookStatus:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Test webhook
    testWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { eventType, payload } = req.body;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to test this webhook'
                });
            }
            
            // Check if webhook supports the event type
            if (!webhook.events.includes(eventType) && !webhook.events.includes('system.*')) {
                return res.status(400).json({
                    success: false,
                    message: 'Webhook does not support this event type'
                });
            }
            
            // Prepare test event
            const testEvent = {
                eventId: crypto.randomBytes(16).toString('hex'),
                eventType: eventType || 'test.event',
                payload: payload || { test: true, timestamp: new Date() }
            };
            
            // Add event to webhook history
            await webhook.addEvent(testEvent);
            
            // Send test webhook
            const result = await WebhookController.deliverWebhook(webhook, testEvent);
            
            return res.status(200).json({
                success: true,
                data: {
                    result,
                    eventId: testEvent.eventId
                }
            });
        } catch (error) {
            console.error("Error in testWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get webhook logs
    getWebhookLogs: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { status, eventType, limit = 50 } = req.query;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this webhook logs'
                });
            }
            
            // Filter event history
            let events = webhook.eventHistory;
            
            if (status) {
                events = events.filter(e => e.status === status);
            }
            
            if (eventType) {
                events = events.filter(e => e.eventType === eventType);
            }
            
            // Limit results
            events = events.slice(0, parseInt(limit));
            
            return res.status(200).json({
                success: true,
                data: {
                    events,
                    healthCheck: webhook.healthCheck
                }
            });
        } catch (error) {
            console.error("Error in getWebhookLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Retry failed webhook
    retryWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id, eventId } = req.params;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to retry this webhook'
                });
            }
            
            // Find the event in history
            const event = webhook.eventHistory.find(e => e.eventId === eventId);
            
            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found in webhook history'
                });
            }
            
            // Only retry failed events
            if (event.status !== 'failed') {
                return res.status(400).json({
                    success: false,
                    message: 'Only failed events can be retried'
                });
            }
            
            // Retry the webhook delivery
            const result = await WebhookController.deliverWebhook(webhook, event);
            
            // Update event status
            await webhook.updateEventStatus(eventId, {
                status: result.success ? 'success' : 'failed',
                response: result.response,
                error: result.error,
                processingTime: result.processingTime,
                attempts: event.attempts + 1
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    result,
                    eventId
                }
            });
        } catch (error) {
            console.error("Error in retryWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Delete webhook
    deleteWebhook: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const webhook = await Webhook.findById(id);
            
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    message: 'Webhook not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && webhook.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to delete this webhook'
                });
            }
            
            await webhook.deleteOne();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
                action: 'custom',
                entityType: 'Other',
                entityId: webhook._id,
                description: `Deleted webhook: ${webhook.name}`,
                status: 'success'
            });
            
            return res.status(204).json({
                success: true,
                data: null
            });
        } catch (error) {
            console.error("Error in deleteWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Trigger webhook event (internal use)
    triggerWebhook: async (eventType, data, context = {}) => {
        try {
            // Find all webhooks for this event
            const webhooks = await Webhook.findForEvent(eventType, context);
            
            const results = [];
            
            for (const webhook of webhooks) {
                try {
                    // Create event
                    const event = {
                        eventId: crypto.randomBytes(16).toString('hex'),
                        eventType,
                        payload: data
                    };
                    
                    // Add to webhook history
                    await webhook.addEvent(event);
                    
                    // Deliver webhook asynchronously
                    WebhookController.deliverWebhook(webhook, event)
                        .then(result => {
                            webhook.updateEventStatus(event.eventId, {
                                status: result.success ? 'success' : 'failed',
                                response: result.response,
                                error: result.error,
                                processingTime: result.processingTime
                            });
                        })
                        .catch(error => {
                            console.error(`Failed to deliver webhook ${webhook._id}:`, error);
                        });
                    
                    results.push({
                        webhookId: webhook._id,
                        eventId: event.eventId,
                        status: 'queued'
                    });
                } catch (error) {
                    console.error(`Error triggering webhook ${webhook._id}:`, error);
                    results.push({
                        webhookId: webhook._id,
                        error: error.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            console.error("Error in triggerWebhook:", error);
            throw error;
        }
    },
    
    // Deliver webhook
    deliverWebhook: async (webhook, event) => {
        const startTime = Date.now();
        
        try {
            // Prepare payload
            const payload = {
                id: event.eventId,
                type: event.eventType,
                timestamp: new Date().toISOString(),
                data: event.payload,
                version: webhook.version || 'v1'
            };
            
            // Generate signature
            const signature = webhook.generateSignature(payload);
            
            // Prepare headers
            const headers = {
                'Content-Type': webhook.format === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
                'X-Webhook-Signature': signature,
                'X-Webhook-Event': event.eventType,
                'X-Webhook-ID': webhook._id.toString(),
                'User-Agent': 'WebhookDelivery/1.0',
                ...webhook.headers
            };
            
            // Make HTTP request
            const response = await axios({
                method: webhook.method || 'POST',
                url: webhook.url,
                data: payload,
                headers,
                timeout: 10000, // 10 seconds timeout
                validateStatus: () => true // Accept any status code
            });
            
            const processingTime = Date.now() - startTime;
            
            // Check if response is successful
            const success = response.status >= 200 && response.status < 300;
            
            return {
                success,
                response: {
                    statusCode: response.status,
                    body: response.data,
                    headers: response.headers
                },
                processingTime
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            return {
                success: false,
                error: {
                    message: error.message,
                    code: error.code || 'UNKNOWN_ERROR',
                    stack: error.stack
                },
                processingTime
            };
        }
    }
};

module.exports = WebhookController;