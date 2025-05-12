// routes/leadAssignmentRoutes.js
const express = require('express');
const router = express.Router();
const LeadAssignmentController = require('../controllers/LeadAssignmentControllers');
const { adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Admin routes (requires admin authentication)
// Create a new lead assignment
router.post('/', adminAuth, LeadAssignmentController.createAssignment);

// Get all lead assignments for an admin
router.get('/admin', adminAuth, LeadAssignmentController.getAdminAssignments);

// Get lead assignments analytics for an admin
router.get('/analytics', adminAuth, LeadAssignmentController.getAdminLeadAnalytics);

// Auto-assign leads for an admin
router.post('/auto-assign', adminAuth, LeadAssignmentController.autoAssignLeads);

// Agent routes (requires agent authentication)
// Get all lead assignments for an agent
router.get('/agent', agentAuth, LeadAssignmentController.getAgentAssignments);

// Common routes (require either admin or agent authentication)
// Get specific lead assignment
router.get('/:id', adminOrAgentAuth, LeadAssignmentController.getAssignment);

// Transfer lead to another agent (admin only)
router.post('/:id/transfer', adminAuth, LeadAssignmentController.transferLead);

// Update lead assignment status (admin or agent)
router.patch('/:id/status', adminOrAgentAuth, LeadAssignmentController.updateAssignmentStatus);

// Delete a lead assignment (admin only)
router.delete('/:id', adminAuth, LeadAssignmentController.deleteAssignment);

module.exports = router;