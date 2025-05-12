// routes/campaignWorkflowRoutes.js
const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/auth');
const {uploadMultiple} = require('../middlewares/multer');
const campaignWorkflowController = require('../controllers/campaignRequestControllers');

// Admin routes for campaign requests
router.post(
    '/requests', 
    adminAuth, 
    uploadMultiple,
    campaignWorkflowController.createCampaignRequest
);

router.get(
    '/requests',
    adminAuth,
    campaignWorkflowController.getAdminCampaignRequests
);

// Admin routes for active campaigns
router.get(
    '/campaigns',
    adminAuth,
    campaignWorkflowController.getAdminCampaigns
);

// Super Admin routes for handling campaign requests
router.get(
    '/admin/requests',
    superAdminAuth,
    campaignWorkflowController.getAllCampaignRequests
);

router.patch(
    '/admin/requests/:id/review',
    superAdminAuth,
    campaignWorkflowController.reviewCampaignRequest
);

router.post(
    '/admin/requests/:id/publish',
    superAdminAuth,
    campaignWorkflowController.publishCampaign
);

module.exports = router;