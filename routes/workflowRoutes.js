// routes/workflowRoutes.js
const express = require('express');
const router = express.Router();
const WorkflowController = require('../controllers/workflowControllers');
const { adminAuth } = require('../middlewares/auth');

// All routes require admin authentication
// Create a new workflow
router.post('/', adminAuth, WorkflowController.createWorkflow);

// Get all workflows for an admin
router.get('/admin', adminAuth, WorkflowController.getAdminWorkflows);

// Get workflow templates
router.get('/templates', adminAuth, WorkflowController.getWorkflowTemplates);

// Get specific workflow by ID
router.get('/:id', adminAuth, WorkflowController.getWorkflow);

// Update workflow
router.patch('/:id', adminAuth, WorkflowController.updateWorkflow);

// Delete workflow
router.delete('/:id', adminAuth, WorkflowController.deleteWorkflow);

// Clone workflow
router.post('/:id/clone', adminAuth, WorkflowController.cloneWorkflow);

// Test workflow with sample data
router.post('/:id/test', adminAuth, WorkflowController.testWorkflow);

// Get workflow analytics
router.get('/:id/analytics', adminAuth, WorkflowController.getWorkflowAnalytics);

module.exports = router;