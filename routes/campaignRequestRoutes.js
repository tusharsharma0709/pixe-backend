// routes/campaignRequestRoutes.js
const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/auth');
const userTypeMiddleware = require('../middlewares/userTypeMiddlewares');
const multer = require('../middlewares/multer');
const campaignWorkflowController = require('../controllers/campaignRequestControllers');

// Configure multer for campaign uploads
const campaignUpload = multer.array('files', 10); // Allow up to 10 files

// Admin routes for campaign requests
router.post(
    '/requests', 
    adminAuth, 
    userTypeMiddleware, // Add this middleware
    campaignUpload,
    campaignWorkflowController.createCampaignRequest
);

router.get(
    '/requests',
    adminAuth,
    campaignWorkflowController.getAdminCampaignRequests
);

// Get campaign request by ID
router.get(
    '/requests/:id',
    adminAuth,
    campaignWorkflowController.getCampaignRequestById
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

router.get(
    '/admin/requests/:id',
    superAdminAuth,
    campaignWorkflowController.getCampaignRequestDetails
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