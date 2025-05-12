// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userControllers');
const { adminAuth, agentAuth, userAuth } = require('../middlewares/auth');

// Public routes (no authentication required)
// User registration/login via phone
router.post('/auth', UserController.registerOrLogin);

// Verify OTP
router.post('/verify-otp', UserController.verifyOTP);

// Admin routes (requires admin authentication)
// Get all users for admin
router.get('/admin', adminAuth, UserController.getAdminUsers);

// Get user analytics
router.get('/admin/analytics', adminAuth, UserController.getUserAnalytics);

// Get specific user by ID (admin)
router.get('/admin/:id', adminAuth, UserController.getUser);

// Update user (admin)
router.patch('/admin/:id', adminAuth, UserController.updateUser);

// Agent routes (requires agent authentication)
// Get users assigned to agent
router.get('/agent', agentAuth, UserController.getAgentUsers);

// Get specific user by ID (agent)
router.get('/agent/:id', agentAuth, UserController.getUser);

// User routes (requires user authentication)
// Get user profile
router.get('/profile', userAuth, UserController.getProfile);

// Update user profile
router.patch('/profile', userAuth, UserController.updateProfile);

module.exports = router;