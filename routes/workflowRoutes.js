// 3. ROUTES
// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const whatsapp = require('../controllers/whatsappControllers');
const { adminAuth } = require('../middlewares/auth');

// Public webhook endpoints for WhatsApp Business API
router.get('/webhook', whatsapp.verifyWebhook);
router.post('/webhook', whatsapp.handleWebhook);

// Admin endpoints for managing WhatsApp flows
router.post('/start-flow', adminAuth, whatsapp.startWhatsAppFlow);
router.get('/session/:sessionId/status', adminAuth, whatsapp.getSessionStatus);
router.get('/active-sessions', adminAuth, whatsapp.getAdminActiveSessions);
router.post('/send-message', adminAuth, whatsapp.sendManualMessage);
router.post('/user/:userId/reset-session', adminAuth, whatsapp.resetUserSession);

module.exports = router;