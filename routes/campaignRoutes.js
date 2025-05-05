// routes/campaignRoutes.js
const express = require('express');
const campaign = require('../controllers/campaignControllers');
const { adminAuth, superAdminAuth } = require('../middlewares/auth');

const router = express.Router();

// SuperAdmin only routes
router.post('/', superAdminAuth, campaign.createCampaign);
router.get('/all', superAdminAuth, campaign.getAllCampaigns);
router.delete('/:id', superAdminAuth, campaign.deleteCampaign);

// Routes for both SuperAdmin and Admin
// SuperAdmin can access all campaigns, Admin can only access their campaigns
router.get('/admin/:adminId', superAdminAuth, campaign.getAdminCampaigns);
router.get('/', adminAuth, campaign.getAdminCampaigns); // Admin's own campaigns

// Shared routes - both SuperAdmin and Admin can use these
// Access control is handled in the controller
router.get('/:id', adminAuth, campaign.getCampaignById);
router.patch('/:id', adminAuth, campaign.updateCampaign);
router.patch('/:id/status', adminAuth, campaign.updateCampaignStatus);
router.post('/assign-workflow', adminAuth, campaign.assignWorkflowToCampaign);
router.get('/:id/stats', adminAuth, campaign.getCampaignStats);
router.get('/:id/users', adminAuth, campaign.getCampaignUsers);

module.exports = router;