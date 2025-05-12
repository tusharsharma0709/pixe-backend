// routes/userSessionRoutes.js
const express = require('express');
const router = express.Router();
const UserSessionController = require('../controllers/userSessionControllers');
const { adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Admin routes (requires admin authentication)
// Create a new user session
router.post('/', adminAuth, UserSessionController.createSession);

// Get all sessions for an admin
router.get('/admin', adminAuth, UserSessionController.getAdminSessions);

// Get session statistics
router.get('/stats', adminAuth, UserSessionController.getSessionStats);

// Transfer session to another agent
router.post('/:id/transfer', adminAuth, UserSessionController.transferSession);

// Agent routes (requires agent authentication)
// Get all sessions for an agent
router.get('/agent', agentAuth, UserSessionController.getAgentSessions);

// Common routes (require either admin or agent authentication)
// Get session by ID
router.get('/:id', adminOrAgentAuth, UserSessionController.getSession);

// Update session
router.patch('/:id', adminOrAgentAuth, UserSessionController.updateSession);

module.exports = router;