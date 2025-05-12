// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Get all webhooks (admins and super admins only)
router.get('/', adminAuth, WebhookController.getAllWebhooks);

// Get webhook by ID (admins and super admins only)
router.get('/:id', adminAuth, WebhookController.getWebhook);

// Create new webhook (admins and super admins only)
router.post('/', adminAuth, WebhookController.createWebhook);

// Update webhook (admins and super admins only)
router.put('/:id', adminAuth, WebhookController.updateWebhook);

// Toggle webhook status (admins and super admins only)
router.put('/:id/toggle', adminAuth, WebhookController.toggleWebhookStatus);

// Test webhook (admins and super admins only)
router.post('/:id/test', adminAuth, WebhookController.testWebhook);

// Get webhook logs (admins and super admins only)
router.get('/:id/logs', adminAuth, WebhookController.getWebhookLogs);

// Retry failed webhook event (admins and super admins only)
router.post('/:id/retry/:eventId', adminAuth, WebhookController.retryWebhook);

// Delete webhook (admins and super admins only)
router.delete('/:id', adminAuth, WebhookController.deleteWebhook);

module.exports = router;