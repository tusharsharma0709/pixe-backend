// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const WhatsAppController = require('../controllers/whatsappControllers');
const { adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Webhook endpoints (no auth required)
router.post('/webhook', WhatsAppController.receiveWebhook);
router.get('/webhook', WhatsAppController.verifyWebhook);

// Workflow processing
router.post('/workflow/process', WhatsAppController.processWorkflowMessage);

// Template management (admin only)
router.get('/templates', adminAuth, WhatsAppController.getWhatsAppTemplates);
router.post('/templates', adminAuth, WhatsAppController.createWhatsAppTemplate);

module.exports = router;