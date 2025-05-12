// routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const AgentController = require('../controllers/agentControllers');
const { adminAuth, agentAuth } = require('../middlewares/auth');

// Public routes (no authentication required)
// Agent login
router.post('/login', AgentController.loginAgent);

// Admin routes (requires admin authentication)
// Register a new agent
router.post('/register', adminAuth, AgentController.registerAgent);

// Get all agents for admin
router.get('/admin', adminAuth, AgentController.getAdminAgents);

// Get specific agent by ID (admin)
router.get('/admin/:id', adminAuth, AgentController.getAgent);

// Update agent (admin)
router.patch('/admin/:id', adminAuth, AgentController.updateAgent);

// Delete agent (admin)
router.delete('/admin/:id', adminAuth, AgentController.deleteAgent);

// Get agent performance (admin)
router.get('/admin/:id/performance', adminAuth, AgentController.getAgentPerformance);

// Agent routes (requires agent authentication)
// Agent logout
router.post('/logout', agentAuth, AgentController.logoutAgent);

// Get agent profile (for agent themselves)
router.get('/profile', agentAuth, AgentController.getProfile);

// Update agent profile (for agent themselves)
router.patch('/profile', agentAuth, AgentController.updateProfile);

// Change agent password
router.post('/change-password', agentAuth, AgentController.changePassword);

module.exports = router;