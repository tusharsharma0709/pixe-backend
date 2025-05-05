// 3. ROUTES
// routes/superadminRoutes.js
const express = require('express');
const superAdmin = require('../controllers/superadminControllers');
const { adminAuth, superAdminAuth } = require('../middlewares/auth');

const router = express.Router();

// Authentication routes
router.post('/register', superAdmin.register);
router.post('/login', superAdmin.login);
router.post('/logout', superAdminAuth, superAdmin.logout);

// Profile management
router.get('/profile', superAdminAuth, superAdmin.getProfile);
router.patch('/update-profile', superAdminAuth, superAdmin.updateProfile);
router.post('/change-password', superAdminAuth, superAdmin.changePassword);

// Admin management
router.get('/admins', superAdminAuth, superAdmin.getAllAdmins);
router.get('/admin/:id', superAdminAuth, superAdmin.getAdminById);
router.patch('/admin-status/:id', superAdminAuth, superAdmin.updateAdminStatus);

// User management
router.get('/users/:id', superAdminAuth, superAdmin.getAllUsers); // Get all users of specific admin
router.get('/user/:id', superAdminAuth, superAdmin.getUserById);

// Campaign management
router.post('/campaign', superAdminAuth, superAdmin.createCampaign);
router.get('/campaigns', superAdminAuth, superAdmin.getAllCampaigns);
router.get('/admin/:adminId/campaigns', superAdminAuth, superAdmin.getAdminCampaigns);
router.patch('/campaign/:id/status', superAdminAuth, superAdmin.updateCampaignStatus);
router.delete('/campaign/:id', superAdminAuth, superAdmin.deleteCampaign);
router.post('/campaign/assign-workflow', superAdminAuth, superAdmin.assignWorkflowToCampaign);

module.exports = router;
