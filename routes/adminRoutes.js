// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminControllers');
const { adminAuth } = require('../middlewares/auth');

// Public routes
router.post('/register', AdminController.register);
router.post('/login', AdminController.login);

// Protected routes
router.post('/logout', adminAuth, AdminController.logout);
router.get('/profile', adminAuth, AdminController.getProfile);
router.put('/profile', adminAuth, AdminController.updateProfile);
router.put('/facebook-credentials', adminAuth, AdminController.updateFacebookCredentials);
router.put('/change-password', adminAuth, AdminController.changePassword);

// Dashboard and stats
router.get('/dashboard/stats', adminAuth, AdminController.getDashboardStats);

// Settings
router.get('/settings', adminAuth, AdminController.getSettings);
router.put('/settings', adminAuth, AdminController.updateSettings);

// WhatsApp
router.get('/whatsapp/info', adminAuth, AdminController.getWhatsAppInfo);

module.exports = router;