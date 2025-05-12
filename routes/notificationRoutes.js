// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationControllers');
const { superAdminAuth, adminAuth, agentAuth } = require('../middlewares/auth');

// Common routes for all authenticated users
// Create a notification (any authenticated user can create notifications)
router.post('/', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.createNotification);

// Get notification by ID (checks permissions internally)
router.get('/:id', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.getNotification);

// Mark notification as read (checks permissions internally)
router.patch('/:id/read', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.markAsRead);

// Archive notification (checks permissions internally)
router.patch('/:id/archive', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.archiveNotification);

// Get notification statistics (checks permissions internally)
router.get('/', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.getNotificationStats);

// Mark multiple notifications as read
router.patch('/mark-read', (req, res, next) => {
    // Try all authentication methods
    superAdminAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, NotificationController.markMultipleAsRead);

// SuperAdmin routes
// Get notifications for super admin
router.get('/superadmin/list', superAdminAuth, NotificationController.getSuperAdminNotifications);

// Send bulk notifications (only super admin)
router.post('/bulk', superAdminAuth, NotificationController.sendBulkNotifications);

// Admin routes
// Get notifications for admin
router.get('/admin/list', adminAuth, NotificationController.getAdminNotifications);

// Agent routes
// Get notifications for agent
router.get('/agent/list', agentAuth, NotificationController.getAgentNotifications);

module.exports = router;