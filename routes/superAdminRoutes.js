// routes/superAdminRoutes.js
const express = require('express');
const router = express.Router();
const SuperAdminController = require('../controllers/superadminControllers');
const { superAdminAuth } = require('../middlewares/auth');

// Public routes (only for initial setup)
router.post('/register', SuperAdminController.register);
router.post('/login', SuperAdminController.login);

// Protected routes
router.post('/logout', superAdminAuth, SuperAdminController.logout);

// Admin management
router.get('/admins', superAdminAuth, SuperAdminController.getAllAdmins);
router.get('/admins/pending', superAdminAuth, SuperAdminController.getPendingRegistrations);
router.get('/admins/:adminId', superAdminAuth, SuperAdminController.getAdminDetail);

// New approval flow endpoints
router.post('/admins/:adminId/verify-facebook', superAdminAuth, SuperAdminController.verifyFacebookCredentials);
router.post('/admins/:adminId/create-app', superAdminAuth, SuperAdminController.createFacebookApp);
router.post('/admins/:adminId/verify-whatsapp', superAdminAuth, SuperAdminController.verifyWhatsAppNumber);
router.post('/admins/:adminId/reject', superAdminAuth, SuperAdminController.rejectRegistration);

// Dashboard and statistics
router.get('/dashboard/stats', superAdminAuth, SuperAdminController.getDashboardStats);

// System settings
router.get('/settings', superAdminAuth, SuperAdminController.getSystemSettings);
router.put('/settings', superAdminAuth, SuperAdminController.updateSystemSettings);

// WhatsApp number management (now shows verified WhatsApp numbers from admin registrations)
router.get('/whatsapp-numbers', superAdminAuth, SuperAdminController.getAllWhatsAppNumbers);

module.exports = router;