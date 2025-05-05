// 3. ROUTES
// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminControllers');
const { adminAuth } = require('../middlewares/auth');

// Auth routes
router.post('/register', admin.register); // SuperAdmin creates admin
router.post('/login', admin.login);
router.post('/logout', adminAuth, admin.logout);

// Profile management
router.get('/profile', adminAuth, admin.Profile);
router.patch('/update-profile', adminAuth, admin.updateProfile);
router.post('/change-password', adminAuth, admin.changePassword);

// Facebook credentials
router.post('/facebook-credentials', adminAuth, admin.updateFacebookCredentials);
router.get('/facebook-status', adminAuth, admin.getFacebookStatus);

// Campaign management
router.get('/campaigns', adminAuth, admin.getAdminCampaigns);

// Workflow management
router.post('/workflows', adminAuth, admin.createWorkflow);
router.get('/workflows', adminAuth, admin.getAllWorkflows);
router.get('/workflows/:id', adminAuth, admin.getWorkflowById);
router.put('/workflows/:id', adminAuth, admin.updateWorkflow);
router.delete('/workflows/:id', adminAuth, admin.deleteWorkflow);
router.post('/link-workflow', adminAuth, admin.linkWorkflowToCampaign);

// User management
router.get('/users', adminAuth, admin.getAllUsers);
router.get('/users/:id', adminAuth, admin.getUserById);
router.patch('/users/:id/status', adminAuth, admin.updateUserStatus);

module.exports = router;
