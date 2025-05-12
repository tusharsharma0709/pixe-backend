// routes/activityLogRoutes.js
const express = require('express');
const router = express.Router();
const ActivityLogController = require('../controllers/activityLogControllers');
const { superAdminAuth, adminAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Create activity log (internal use - typically called from other services)
router.post('/', adminOrAgentAuth, ActivityLogController.createActivityLog);

// Admin routes
// Get activity logs for admin
router.get('/admin', adminAuth, ActivityLogController.getAdminActivityLogs);

// SuperAdmin routes
// Get all activity logs (super admin)
router.get('/superadmin', superAdminAuth, ActivityLogController.getSuperAdminActivityLogs);

// Common routes
// Get activity logs for specific entity
router.get('/entity/:entityType/:entityId', adminOrAgentAuth, ActivityLogController.getEntityActivityLogs);

// Get activity logs for specific actor
router.get('/actor/:actorModel/:actorId', adminOrAgentAuth, ActivityLogController.getActorActivityLogs);

// Statistics routes
// Get activity statistics
router.get('/stats', (req, res, next) => {
    // Allow both admin and superadmin
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, next);
        } else {
            next();
        }
    });
}, ActivityLogController.getActivityLogStats);

// Search activity logs
router.get('/search', (req, res, next) => {
    // Allow both admin and superadmin
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, next);
        } else {
            next();
        }
    });
}, ActivityLogController.searchActivityLogs);

// Export activity logs
router.get('/export', (req, res, next) => {
    // Allow both admin and superadmin
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, next);
        } else {
            next();
        }
    });
}, ActivityLogController.exportActivityLogs);

module.exports = router;