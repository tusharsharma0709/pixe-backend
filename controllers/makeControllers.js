// controllers/makeController.js - FIXED VERSION

const makeServices = require('../services/makeServices');
const { Admin } = require('../models/Admins');
const { ActivityLog } = require('../models/ActivityLogs');

// Input validation helper
const validateRequiredFields = (fields, body) => {
    const missing = fields.filter(field => !body[field]);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
};

const MakeController = {
    /**
     * SCENARIO MANAGEMENT
     */
    
    // Get all scenarios - FIXED
    getScenarios: async (req, res) => {
        try {
            const adminId = req.adminId;
            const result = await makeServices.getScenarios();
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_scenarios_viewed',
                entityType: 'MakeScenario',
                description: `Viewed Make.com scenarios (${result.total} found)`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: `Found ${result.total} Make.com scenarios`, // ✅ FIXED
                data: result.data, // ✅ ADDED missing data
                meta: {
                    total: result.total,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting Make scenarios:', error); // ✅ FIXED error message
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch Make.com scenarios', // ✅ FIXED error message
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Get single scenario
    getScenario: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            
            const result = await makeServices.getScenario(id);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_scenario_viewed',
                entityType: 'MakeScenario',
                entityId: id,
                description: `Viewed Make.com scenario: ${result.data?.name || id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Make.com scenario retrieved successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error getting Make scenario:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch Make.com scenario',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Run/trigger a scenario
    runScenario: async (req, res) => {
        try {
            const { id } = req.params;
            const inputData = req.body;
            const adminId = req.adminId;
            
            console.log(`🚀 Admin ${adminId} triggering Make scenario ${id} with data:`, inputData);
            
            const result = await makeServices.runMakeScenario(id, inputData);
            
            // Get admin details for logging
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_scenario_triggered',
                entityType: 'MakeScenario',
                entityId: id,
                description: `Triggered Make.com scenario: ${id}`,
                adminId: adminId,
                metadata: {
                    inputDataKeys: Object.keys(inputData || {}),
                    triggeredAt: result.triggeredAt
                }
            });
            
            return res.status(200).json({
                success: true,
                message: 'Make.com scenario triggered successfully',
                data: result.data,
                meta: {
                    scenarioId: result.scenarioId,
                    triggeredAt: result.triggeredAt,
                    triggeredBy: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin'
                }
            });
        } catch (error) {
            console.error('Error running Make scenario:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to trigger Make.com scenario',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Create new scenario
    createScenario: async (req, res) => {
        try {
            const scenarioData = req.body;
            const adminId = req.adminId;
            
            // Validate required fields
            validateRequiredFields(['name'], scenarioData);
            
            const result = await makeServices.createScenario(scenarioData);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_scenario_created',
                entityType: 'MakeScenario',
                entityId: result.data?.id,
                description: `Created Make.com scenario: ${scenarioData.name}`,
                adminId: adminId
            });
            
            return res.status(201).json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            console.error('Error creating Make scenario:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to create Make.com scenario',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Update scenario
    updateScenario: async (req, res) => {
        try {
            const { id } = req.params;
            const scenarioData = req.body;
            const adminId = req.adminId;
            
            const result = await makeServices.updateScenario(id, scenarioData);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_scenario_updated',
                entityType: 'MakeScenario',
                entityId: id,
                description: `Updated Make.com scenario: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            console.error('Error updating Make scenario:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to update Make.com scenario',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Delete scenario
    deleteScenario: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            
            const result = await makeServices.deleteScenario(id);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_scenario_deleted',
                entityType: 'MakeScenario',
                entityId: id,
                description: `Deleted Make.com scenario: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Error deleting Make scenario:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to delete Make.com scenario',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Get scenario execution history
    getScenarioExecutions: async (req, res) => {
        try {
            const { id } = req.params;
            const { limit = 10 } = req.query;
            const adminId = req.adminId;
            
            const result = await makeServices.getScenarioExecutions(id, parseInt(limit));
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_scenario_executions_viewed',
                entityType: 'MakeScenario',
                entityId: id,
                description: `Viewed execution history for Make.com scenario: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Scenario execution history retrieved successfully',
                data: result.data,
                meta: {
                    scenarioId: result.scenarioId,
                    limit: result.limit
                }
            });
        } catch (error) {
            console.error('Error getting scenario executions:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch scenario execution history',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    /**
     * WEBHOOK MANAGEMENT
     */
    
    // Get all webhooks
    getWebhooks: async (req, res) => {
        try {
            const adminId = req.adminId;
            const result = await makeServices.getWebhooks();
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_webhooks_viewed',
                entityType: 'MakeWebhook',
                description: `Viewed Make.com webhooks (${result.total} found)`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: `Found ${result.total} Make.com webhooks`,
                data: result.data,
                meta: {
                    total: result.total,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting Make webhooks:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch Make.com webhooks',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Get single webhook
    getWebhook: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            
            const result = await makeServices.getWebhook(id);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_webhook_viewed',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Viewed Make.com webhook: ${result.data?.name || id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Make.com webhook retrieved successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error getting Make webhook:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch Make.com webhook',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Create webhook
    createWebhook: async (req, res) => {
        try {
            const webhookData = req.body;
            const adminId = req.adminId;
            
            // Validate required fields
            validateRequiredFields(['name'], webhookData);
            
            const result = await makeServices.createWebhook(webhookData);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_webhook_created',
                entityType: 'MakeWebhook',
                entityId: result.data?.id,
                description: `Created Make.com webhook: ${webhookData.name}`,
                adminId: adminId
            });
            
            return res.status(201).json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            console.error('Error creating Make webhook:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to create Make.com webhook',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Update webhook
    updateWebhook: async (req, res) => {
        try {
            const { id } = req.params;
            const webhookData = req.body;
            const adminId = req.adminId;
            
            const result = await makeServices.updateWebhook(id, webhookData);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_webhook_updated',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Updated Make.com webhook: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            console.error('Error updating Make webhook:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to update Make.com webhook',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Delete webhook
    deleteWebhook: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            
            const result = await makeServices.deleteWebhook(id);
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_webhook_deleted',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Deleted Make.com webhook: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Error deleting Make webhook:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to delete Make.com webhook',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    /**
     * WEBHOOK QUEUE MANAGEMENT
     */
    
    // Get webhook queue
    getWebhookQueue: async (req, res) => {
        try {
            const { id } = req.params;
            const { limit = 100 } = req.query;
            const adminId = req.adminId;
            
            const result = await makeServices.getWebhookQueue(id, parseInt(limit));
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_webhook_queue_viewed',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Viewed webhook queue for Make.com webhook: ${id} (${result.count} items)`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: `Found ${result.count} items in webhook queue`,
                data: result.data,
                meta: {
                    hookId: result.hookId,
                    count: result.count,
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error('Error getting webhook queue:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch webhook queue',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Delete webhook queue items
    deleteWebhookQueueItems: async (req, res) => {
        try {
            const { id } = req.params;
            const { ids, deleteAll = false } = req.body;
            const adminId = req.adminId;
            
            const result = await makeServices.deleteWebhookQueueItems(id, { ids, deleteAll });
            
            // Get admin details
            const admin = await Admin.findById(adminId);
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'make_webhook_queue_cleared',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Cleared webhook queue items for Make.com webhook: ${id}`,
                adminId: adminId,
                metadata: {
                    deletedAll: deleteAll,
                    itemCount: deleteAll ? 'all' : (ids?.length || 0)
                }
            });
            
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            console.error('Error deleting webhook queue items:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to delete webhook queue items',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    // Get webhook logs
    getWebhookLogs: async (req, res) => {
        try {
            const { id } = req.params;
            const { limit = 50 } = req.query;
            const adminId = req.adminId;
            
            const result = await makeServices.getWebhookLogs(id, parseInt(limit));
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_webhook_logs_viewed',
                entityType: 'MakeWebhook',
                entityId: id,
                description: `Viewed logs for Make.com webhook: ${id}`,
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Webhook logs retrieved successfully',
                data: result.data,
                meta: {
                    hookId: result.hookId,
                    limit: result.limit
                }
            });
        } catch (error) {
            console.error('Error getting webhook logs:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch webhook logs',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    },
    
    /**
     * UTILITY ENDPOINTS
     */
    
    // Test Make.com connection
    testConnection: async (req, res) => {
        try {
            const adminId = req.adminId;
            const result = await makeServices.testConnection();
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_connection_tested',
                entityType: 'MakeService',
                description: `Tested Make.com connection: ${result.success ? 'Success' : 'Failed'}`,
                adminId: adminId,
                metadata: {
                    connectionStatus: result.success,
                    error: result.error || null
                }
            });
            
            return res.status(result.success ? 200 : 500).json({
                success: result.success,
                message: result.message,
                data: result.config || null,
                error: result.error || null
            });
        } catch (error) {
            console.error('Error testing Make connection:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to test Make.com connection',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    
    // Get service status
    getServiceStatus: async (req, res) => {
        try {
            const adminId = req.adminId;
            const result = await makeServices.getServiceStatus();
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_status_checked',
                entityType: 'MakeService',
                description: 'Checked Make.com service status',
                adminId: adminId
            });
            
            return res.status(200).json({
                success: result.success,
                message: 'Make.com service status retrieved',
                data: result.status
            });
        } catch (error) {
            console.error('Error getting service status:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get Make.com service status',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    
    // Get Make.com configuration (for debugging)
    getConfiguration: async (req, res) => {
        try {
            const adminId = req.adminId;
            
            // Only show config in development or to super admins
            const admin = await Admin.findById(adminId);
            if (!admin || (process.env.NODE_ENV === 'production' && admin.role !== 'super_admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const config = makeServices.config;
            
            // Log activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                action: 'make_config_viewed',
                entityType: 'MakeService',
                description: 'Viewed Make.com configuration',
                adminId: adminId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Make.com configuration retrieved',
                data: {
                    baseUrl: config.baseUrl,
                    hasToken: !!config.apiToken,
                    tokenLength: config.apiToken ? config.apiToken.length : 0,
                    timeout: config.timeout,
                    retries: config.retries,
                    environment: process.env.NODE_ENV
                }
            });
        } catch (error) {
            console.error('Error getting Make configuration:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get Make.com configuration',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = MakeController;