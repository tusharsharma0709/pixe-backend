// routes/whatsappNumberRoutes.js
const express = require('express');
const router = express.Router();
const WhatsAppNumberController = require('../controllers/whatsappNumberControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Get all WhatsApp numbers (admins and super admins)
router.get('/', adminAuth, WhatsAppNumberController.getAllNumbers);

// Get available numbers for assignment (super admin only)
router.get('/available', superAdminAuth, WhatsAppNumberController.getAvailableNumbers);

// Get WhatsApp number by ID (admins and super admins)
router.get('/:id', adminAuth, WhatsAppNumberController.getNumber);

// Create new WhatsApp number (super admin only)
router.post('/', superAdminAuth, WhatsAppNumberController.createNumber);

// Assign WhatsApp number to admin (super admin only)
router.post('/:id/assign', superAdminAuth, WhatsAppNumberController.assignNumber);

// Unassign WhatsApp number (super admin only)
router.post('/:id/unassign', superAdminAuth, WhatsAppNumberController.unassignNumber);

// Update WhatsApp number (admins and super admins)
router.put('/:id', adminAuth, WhatsAppNumberController.updateNumber);

// Verify WhatsApp number (admins and super admins)
router.post('/:id/verify', adminAuth, WhatsAppNumberController.verifyNumber);

// Get WhatsApp number metrics (admins and super admins)
router.get('/:id/metrics', adminAuth, WhatsAppNumberController.getNumberMetrics);

// Sync WhatsApp number with WhatsApp Business API (admins and super admins)
router.post('/:id/sync', adminAuth, WhatsAppNumberController.syncNumber);

// Delete WhatsApp number (super admin only)
router.delete('/:id', superAdminAuth, WhatsAppNumberController.deleteNumber);

module.exports = router;