// routes/superAdminRoutes.js
const express = require('express');
const router = express.Router();
const SuperAdminController = require('../controllers/superAdminControllers');
const { superAdminAuth } = require('../middlewares/auth');

// Public routes (only for initial setup)
router.post('/register', SuperAdminController.register);
router.post('/login', SuperAdminController.login);

// Protected routes
router.post('/logout', superAdminAuth, SuperAdminController.logout);

// Admin management
router.get('/admins', superAdminAuth, SuperAdminController.getAllAdmins);
router.put('/admins/:adminId/review', superAdminAuth, SuperAdminController.reviewAdmin);
router.post('/admins/:adminId/assign-whatsapp', superAdminAuth, SuperAdminController.assignWhatsAppNumber);

// WhatsApp number management
router.get('/whatsapp-numbers', superAdminAuth, SuperAdminController.getAllWhatsAppNumbers);

// Dashboard and statistics
router.get('/dashboard/stats', superAdminAuth, SuperAdminController.getDashboardStats);

// System settings
router.get('/settings', superAdminAuth, SuperAdminController.getSystemSettings);
router.put('/settings', superAdminAuth, SuperAdminController.updateSystemSettings);

module.exports = router;