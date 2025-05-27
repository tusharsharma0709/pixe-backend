// routes/v1/makeRoutes.js - Updated Make.com routes

const express = require('express');
const router = express.Router();
const makeController = require('../controllers/makeControllers'); // Fixed import path
const { adminAuth } = require('../middlewares/auth'); // Assuming you have admin auth middleware

// Apply admin authentication to all routes
router.use(adminAuth);

/**
 * SCENARIO ROUTES
 */

// GET /api/v1/make/scenarios - Get all scenarios
router.get('/scenarios', makeController.getScenarios);

// GET /api/v1/make/scenarios/:id - Get single scenario
router.get('/scenarios/:id', makeController.getScenario);

// POST /api/v1/make/scenarios/:id/run - Run/trigger a scenario
router.post('/scenarios/:id/run', makeController.runScenario);

// POST /api/v1/make/scenarios - Create new scenario
router.post('/scenarios', makeController.createScenario);

// PUT /api/v1/make/scenarios/:id - Update scenario
router.put('/scenarios/:id', makeController.updateScenario);

// DELETE /api/v1/make/scenarios/:id - Delete scenario
router.delete('/scenarios/:id', makeController.deleteScenario);

// GET /api/v1/make/scenarios/:id/executions - Get scenario execution history
router.get('/scenarios/:id/executions', makeController.getScenarioExecutions);

/**
 * WEBHOOK ROUTES
 */

// GET /api/v1/make/webhooks - Get all webhooks
router.get('/webhooks', makeController.getWebhooks);

// GET /api/v1/make/webhooks/:id - Get single webhook
router.get('/webhooks/:id', makeController.getWebhook);

// POST /api/v1/make/webhooks - Create webhook
router.post('/webhooks', makeController.createWebhook);

// PUT /api/v1/make/webhooks/:id - Update webhook
router.put('/webhooks/:id', makeController.updateWebhook);

// DELETE /api/v1/make/webhooks/:id - Delete webhook
router.delete('/webhooks/:id', makeController.deleteWebhook);

/**
 * WEBHOOK QUEUE ROUTES (for Pull webhooks)
 */

// GET /api/v1/make/webhooks/:id/queue - Get webhook queue
router.get('/webhooks/:id/queue', makeController.getWebhookQueue);

// DELETE /api/v1/make/webhooks/:id/queue - Delete webhook queue items
router.delete('/webhooks/:id/queue', makeController.deleteWebhookQueueItems);

// GET /api/v1/make/webhooks/:id/logs - Get webhook logs
router.get('/webhooks/:id/logs', makeController.getWebhookLogs);

/**
 * UTILITY ROUTES
 */

// GET /api/v1/make/test-connection - Test Make.com connection
router.get('/test-connection', makeController.testConnection);

// GET /api/v1/make/status - Get service status
router.get('/status', makeController.getServiceStatus);

// GET /api/v1/make/config - Get configuration (admin only)
router.get('/config', makeController.getConfiguration);

module.exports = router;