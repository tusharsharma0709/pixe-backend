// routes/whatsappTemplateRoutes.js
const express = require('express');
const router = express.Router();
const WhatsAppTemplateController = require('../controllers/whatsappTemplateControllers');
const { adminAuth, superAdminAuth } = require('../middlewares/auth');

// Admin routes
router.post('/', adminAuth, WhatsAppTemplateController.createTemplate);
router.get('/admin', adminAuth, WhatsAppTemplateController.getAdminTemplates);
router.get('/:id', adminAuth, WhatsAppTemplateController.getTemplate);
router.put('/:id', adminAuth, WhatsAppTemplateController.updateTemplate);
router.delete('/:id', adminAuth, WhatsAppTemplateController.deleteTemplate);
router.post('/:id/submit', adminAuth, WhatsAppTemplateController.submitForReview);
router.get('/:id/stats', adminAuth, WhatsAppTemplateController.getTemplateUsageStats);

// Super Admin routes
router.get('/superadmin/all', superAdminAuth, WhatsAppTemplateController.getSuperAdminTemplates);
router.put('/:id/review', superAdminAuth, WhatsAppTemplateController.reviewTemplate);

module.exports = router;