// routes/statisticsRoutes.js
const express = require('express');
const router = express.Router();
const StatisticsController = require('../controllers/statisticsControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Create or update statistics (Admin/Agent)
router.post('/upsert', adminOrAgentAuth, StatisticsController.upsertStatistic);

// Get statistics for Super Admin (Platform-wide)
router.get('/super-admin', superAdminAuth, StatisticsController.getSuperAdminStatistics);

// Get statistics for Admin
router.get('/admin', adminAuth, StatisticsController.getAdminStatistics);

// Get statistics for Agent
router.get('/agent', agentAuth, StatisticsController.getAgentStatistics);

// Get dashboard statistics (consolidated view)
router.get('/dashboard', adminOrAgentAuth, StatisticsController.getDashboardStatistics);

// Record campaign metrics
router.post('/campaign-metrics', adminAuth, StatisticsController.recordCampaignMetrics);

// Get comparison statistics
router.get('/comparison', adminAuth, StatisticsController.getComparisonStatistics);

// Export statistics data
router.get('/export', adminAuth, StatisticsController.exportStatistics);

module.exports = router;