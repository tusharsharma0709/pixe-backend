// controllers/NotificationController.js
const { Notification } = require('../models/Notifications');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { SuperAdmin } = require('../models/SuperAdmins');
const { ActivityLog } = require('../models/ActivityLogs');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Helper function to log activity
const logActivity = async (data) => {
    try {
        const activityLog = new ActivityLog(data);
        await activityLog.save();
        return activityLog;
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

const NotificationController = {
    // Create a new notification
    createNotification: async (req, res) => {
        try {
            const {
                title,
                description,
                type,
                priority,
                forSuperAdmin,
                forAdmin,
                forAgent,
                relatedTo,
                actionUrl,
                metadata
            } = req.body;

            // Validate required fields
            if (!title || !description || !type) {
                return res.status(400).json({
                    success: false,
                    message: "Title, description, and type are required"
                });
            }

            // Ensure at least one recipient is specified
            if (!forSuperAdmin && !forAdmin && !forAgent) {
                return res.status(400).json({
                    success: false,
                    message: "At least one recipient must be specified"
                });
            }

            // Create notification
            const notification = new Notification({
                title,
                description,
                type,
                priority: priority || 'medium',
                forSuperAdmin,
                forAdmin,
                forAgent,
                relatedTo,
                actionUrl,
                metadata
            });

            await notification.save();

            // Get actor details for logging
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');
            let actorName = null;
            let actorModel = null;

            if (actorRole === 'superadmin') {
                const superAdmin = await SuperAdmin.findById(actorId);
                actorName = superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null;
                actorModel = 'SuperAdmins';
            } else if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
                actorModel = 'Admins';
            } else {
                const agent = await Agent.findById(actorId);
                actorName = agent ? `${agent.first_name} ${agent.last_name}` : null;
                actorModel = 'Agents';
            }

            // Log activity
            await logActivity({
                actorId,
                actorModel,
                actorName,
                action: 'notification_sent',
                entityType: 'Notification',
                entityId: notification._id,
                description: `Created notification: ${title}`,
                adminId: forAdmin
            });

            return res.status(201).json({
                success: true,
                message: "Notification created successfully",
                data: notification
            });
        } catch (error) {
            console.error("Error in createNotification:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get notifications for super admin
    getSuperAdminNotifications: async (req, res) => {
        try {
            const {
                status,
                type,
                priority,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            // Build query
            const query = { forSuperAdmin: true };

            if (status) query.status = status;
            if (type) query.type = type;
            if (priority) query.priority = priority;

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Notification.countDocuments(query);

            // Execute query with pagination
            const notifications = await Notification.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get unread count
            const unreadCount = await Notification.countDocuments({
                forSuperAdmin: true,
                status: 'unread'
            });

            return res.status(200).json({
                success: true,
                data: notifications,
                unreadCount,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getSuperAdminNotifications:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get notifications for admin
    getAdminNotifications: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                type,
                priority,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            // Build query
            const query = { forAdmin: adminId };

            if (status) query.status = status;
            if (type) query.type = type;
            if (priority) query.priority = priority;

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Notification.countDocuments(query);

            // Execute query with pagination
            const notifications = await Notification.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get unread count
            const unreadCount = await Notification.countDocuments({
                forAdmin: adminId,
                status: 'unread'
            });

            return res.status(200).json({
                success: true,
                data: notifications,
                unreadCount,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminNotifications:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get notifications for agent
    getAgentNotifications: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                status,
                type,
                priority,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            // Build query
            const query = { forAgent: agentId };

            if (status) query.status = status;
            if (type) query.type = type;
            if (priority) query.priority = priority;

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Notification.countDocuments(query);

            // Execute query with pagination
            const notifications = await Notification.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get unread count
            const unreadCount = await Notification.countDocuments({
                forAgent: agentId,
                status: 'unread'
            });

            return res.status(200).json({
                success: true,
                data: notifications,
                unreadCount,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAgentNotifications:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get a specific notification
    getNotification: async (req, res) => {
        try {
            const { id } = req.params;

            const notification = await Notification.findById(id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            // Check permissions
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');

            let hasPermission = false;

            if (actorRole === 'superadmin' && notification.forSuperAdmin) {
                hasPermission = true;
            } else if (actorRole === 'admin' && notification.forAdmin && notification.forAdmin.toString() === actorId) {
                hasPermission = true;
            } else if (actorRole === 'agent' && notification.forAgent && notification.forAgent.toString() === actorId) {
                hasPermission = true;
            }

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this notification"
                });
            }

            return res.status(200).json({
                success: true,
                data: notification
            });
        } catch (error) {
            console.error("Error in getNotification:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Mark notification as read
    markAsRead: async (req, res) => {
        try {
            const { id } = req.params;
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'SuperAdmin' : (req.adminId ? 'Admin' : 'Agent');

            const notification = await Notification.findById(id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            // Check permissions
            let hasPermission = false;

            if (actorRole === 'SuperAdmin' && notification.forSuperAdmin) {
                hasPermission = true;
            } else if (actorRole === 'Admin' && notification.forAdmin && notification.forAdmin.toString() === actorId) {
                hasPermission = true;
            } else if (actorRole === 'Agent' && notification.forAgent && notification.forAgent.toString() === actorId) {
                hasPermission = true;
            }

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this notification"
                });
            }

            // Check if already read by this user
            const alreadyRead = notification.readBy.some(
                item => item.userId.toString() === actorId && item.userType === actorRole
            );

            if (!alreadyRead) {
                notification.readBy.push({
                    userId: actorId,
                    userType: actorRole,
                    readAt: new Date()
                });
            }

            notification.status = 'read';
            await notification.save();

            return res.status(200).json({
                success: true,
                message: "Notification marked as read",
                data: notification
            });
        } catch (error) {
            console.error("Error in markAsRead:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Mark multiple notifications as read
    markMultipleAsRead: async (req, res) => {
        try {
            const { notificationIds } = req.body;
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'SuperAdmin' : (req.adminId ? 'Admin' : 'Agent');

            if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Notification IDs array is required"
                });
            }

            // Build query based on role
            const query = { _id: { $in: notificationIds } };

            if (actorRole === 'SuperAdmin') {
                query.forSuperAdmin = true;
            } else if (actorRole === 'Admin') {
                query.forAdmin = actorId;
            } else {
                query.forAgent = actorId;
            }

            // Update notifications
            const result = await Notification.updateMany(
                query,
                {
                    $set: { status: 'read' },
                    $addToSet: {
                        readBy: {
                            userId: actorId,
                            userType: actorRole,
                            readAt: new Date()
                        }
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: `${result.modifiedCount} notifications marked as read`,
                data: {
                    modified: result.modifiedCount
                }
            });
        } catch (error) {
            console.error("Error in markMultipleAsRead:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Archive notification
    archiveNotification: async (req, res) => {
        try {
            const { id } = req.params;
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');

            const notification = await Notification.findById(id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            // Check permissions
            let hasPermission = false;

            if (actorRole === 'superadmin' && notification.forSuperAdmin) {
                hasPermission = true;
            } else if (actorRole === 'admin' && notification.forAdmin && notification.forAdmin.toString() === actorId) {
                hasPermission = true;
            } else if (actorRole === 'agent' && notification.forAgent && notification.forAgent.toString() === actorId) {
                hasPermission = true;
            }

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to archive this notification"
                });
            }

            notification.status = 'archived';
            await notification.save();

            return res.status(200).json({
                success: true,
                message: "Notification archived successfully",
                data: notification
            });
        } catch (error) {
            console.error("Error in archiveNotification:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get notification statistics
    getNotificationStats: async (req, res) => {
        try {
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');

            // Build query based on role
            const query = {};

            if (actorRole === 'superadmin') {
                query.forSuperAdmin = true;
            } else if (actorRole === 'admin') {
                query.forAdmin = actorId;
            } else {
                query.forAgent = actorId;
            }

            // Get counts by status
            const statusCounts = await Notification.aggregate([
                { $match: query },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get counts by type
            const typeCounts = await Notification.aggregate([
                { $match: query },
                { $group: { _id: "$type", count: { $sum: 1 } } }
            ]);

            // Get counts by priority
            const priorityCounts = await Notification.aggregate([
                { $match: query },
                { $group: { _id: "$priority", count: { $sum: 1 } } }
            ]);

            // Get recent notifications
            const recentNotifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(5);

            // Get urgent unread count
            const urgentUnreadCount = await Notification.countDocuments({
                ...query,
                status: 'unread',
                priority: 'urgent'
            });

            return res.status(200).json({
                success: true,
                data: {
                    statusBreakdown: statusCounts.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    typeBreakdown: typeCounts.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    priorityBreakdown: priorityCounts.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    recentNotifications,
                    urgentUnreadCount
                }
            });
        } catch (error) {
            console.error("Error in getNotificationStats:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Send bulk notifications
    sendBulkNotifications: async (req, res) => {
        try {
            const {
                title,
                description,
                type,
                priority,
                recipients,
                relatedTo,
                actionUrl,
                metadata
            } = req.body;

            // Validate required fields
            if (!title || !description || !type || !recipients) {
                return res.status(400).json({
                    success: false,
                    message: "Title, description, type, and recipients are required"
                });
            }

            if (!Array.isArray(recipients) || recipients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Recipients must be a non-empty array"
                });
            }

            const createdNotifications = [];

            // Create notifications for each recipient
            for (const recipient of recipients) {
                const notificationData = {
                    title,
                    description,
                    type,
                    priority: priority || 'medium',
                    relatedTo,
                    actionUrl,
                    metadata
                };

                // Set recipient based on type
                if (recipient.type === 'superadmin') {
                    notificationData.forSuperAdmin = true;
                } else if (recipient.type === 'admin') {
                    notificationData.forAdmin = recipient.id;
                } else if (recipient.type === 'agent') {
                    notificationData.forAgent = recipient.id;
                } else {
                    continue; // Skip invalid recipient types
                }

                const notification = new Notification(notificationData);
                await notification.save();
                createdNotifications.push(notification);
            }

            return res.status(201).json({
                success: true,
                message: `${createdNotifications.length} notifications sent successfully`,
                data: {
                    count: createdNotifications.length,
                    notifications: createdNotifications
                }
            });
        } catch (error) {
            console.error("Error in sendBulkNotifications:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = NotificationController;