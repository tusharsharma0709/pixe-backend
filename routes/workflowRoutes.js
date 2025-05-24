// routes/workflowRoutes.js - Enhanced with SurePass integration
const express = require('express');
const router = express.Router();
const WorkflowController = require('../controllers/workflowControllers');
const { adminAuth, agentAuth } = require('../middlewares/auth');

// All routes require admin authentication

// Create a new workflow (ENHANCED with SurePass processing)
router.post('/', adminAuth, WorkflowController.createWorkflow);

// Get all workflows for an admin (ENHANCED with SurePass filtering)
router.get('/admin', adminAuth, WorkflowController.getAdminWorkflows);

// Get workflow templates
router.get('/templates', adminAuth, WorkflowController.getWorkflowTemplates);

// NEW: SurePass integration helper routes
router.get('/surepass/endpoints', adminAuth, WorkflowController.getSurePassEndpoints);
router.post('/surepass/validate-node', adminAuth, WorkflowController.validateSurePassNode);

// Get specific workflow by ID (ENHANCED with SurePass analysis)
router.get('/:id', adminAuth, WorkflowController.getWorkflow);

// Update workflow (ENHANCED with SurePass validation)
router.patch('/:id', adminAuth, WorkflowController.updateWorkflow);

// Delete workflow (ENHANCED with tracking)
router.delete('/:id', adminAuth, WorkflowController.deleteWorkflow);

// Clone workflow
router.post('/:id/clone', adminAuth, WorkflowController.cloneWorkflow);

// Test workflow with sample data
router.post('/:id/test', adminAuth, WorkflowController.testWorkflow);

// Get workflow analytics (ENHANCED with unified analytics)
router.get('/:id/analytics', adminAuth, WorkflowController.getWorkflowAnalytics);

module.exports = router;