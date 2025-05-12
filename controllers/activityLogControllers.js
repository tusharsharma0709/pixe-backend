// controllers/ActivityLogController.js
const { ActivityLog } = require('../models/ActivityLogs');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { User } = require('../models/Users');
const { SuperAdmin } = require('../models/SuperAdmins');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const ActivityLogController = {
    // Create a new activity log
    createActivityLog: async (req, res) => {
        try {
            const {
                actorId,
                actorModel,
                actorName,
                action,
                entityType,
                entityId,
                description,
                details,
                changedFields,
                ip,
                userAgent,
                deviceInfo,
                status,
                adminId,
                metadata
            } = req.body;

            // Validate required fields
            if (!actorId || !actorModel || !action || !entityType || !description) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields"
                });
            }

            // Create activity log
            const activityLog = new ActivityLog({
                actorId,
                actorModel,
                actorName,
                action,
                entityType,
                entityId,
                description,
                details,
                changedFields,
                ip,
                userAgent,
                deviceInfo,
                status: status || 'success',
                adminId,
                metadata
            });

            await activityLog.save();

            return res.status(201).json({
                success: true,
                message: "Activity log created successfully",
                data: activityLog
            });
        } catch (error) {
            console.error("Error in createActivityLog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get activity logs for admin
    getAdminActivityLogs: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                actorModel,
                action,
                entityType,
                status,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            // Build query
            const query = { adminId };

            if (actorModel) query.actorModel = actorModel;
            if (action) query.action = action;
            if (entityType) query.entityType = entityType;
            if (status) query.status = status;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                query.$or = [
                    { actorName: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

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
            const totalCount = await ActivityLog.countDocuments(query);

            // Execute query with pagination
            const activityLogs = await ActivityLog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: activityLogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get activity logs for super admin
    getSuperAdminActivityLogs: async (req, res) => {
        try {
            const {
                adminId,
                actorModel,
                action,
                entityType,
                status,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            // Build query
            const query = {};

            if (adminId) query.adminId = adminId;
            if (actorModel) query.actorModel = actorModel;
            if (action) query.action = action;
            if (entityType) query.entityType = entityType;
            if (status) query.status = status;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                query.$or = [
                    { actorName: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { entityId: { $regex: search, $options: 'i' } }
                ];
            }

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
            const totalCount = await ActivityLog.countDocuments(query);

            // Execute query with pagination
            const activityLogs = await ActivityLog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: activityLogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getSuperAdminActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get activity logs for a specific entity
    getEntityActivityLogs: async (req, res) => {
        try {
            const { entityType, entityId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            // Build query
            const query = { entityType, entityId };

            // Add permission check for admin
            if (actorRole === 'admin') {
                query.adminId = actorId;
            }

            // Build sort options - default to newest first
            const sortOptions = { createdAt: -1 };

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await ActivityLog.countDocuments(query);

            // Execute query with pagination
            const activityLogs = await ActivityLog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: activityLogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getEntityActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get activity logs for an actor
    getActorActivityLogs: async (req, res) => {
        try {
            const { actorModel, actorId } = req.params;
            const { page = 1, limit = 20, action, entityType, startDate, endDate } = req.query;

            // Build query
            const query = { actorModel, actorId };

            if (action) query.action = action;
            if (entityType) query.entityType = entityType;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Build sort options - default to newest first
            const sortOptions = { createdAt: -1 };

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await ActivityLog.countDocuments(query);

            // Execute query with pagination
            const activityLogs = await ActivityLog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: activityLogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getActorActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get activity log statistics
    getActivityLogStats: async (req, res) => {
        try {
            const { startDate, endDate, adminId } = req.query;
            const actorId = req.superAdminId || req.adminId;
            const actorRole = req.superAdminId ? 'superadmin' : 'admin';

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Build query based on role
            const query = { ...dateFilter };
            if (actorRole === 'admin') {
                query.adminId = actorId;
            } else if (adminId) {
                query.adminId = adminId;
            }

            // Get total activity count
            const totalActivities = await ActivityLog.countDocuments(query);

            // Get activities by action
            const activitiesByAction = await ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get activities by actor model
            const activitiesByActor = await ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: "$actorModel", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get activities by entity type
            const activitiesByEntity = await ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: "$entityType", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get activities by status
            const activitiesByStatus = await ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get daily activity count
            const dailyActivity = await ActivityLog.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]);

            // Format daily activity
            const formattedDailyActivity = dailyActivity.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                count: item.count
            }));

            // Get most active users
            const mostActiveUsers = await ActivityLog.aggregate([
                { $match: { ...query, actorModel: 'Users' } },
                { $group: { _id: "$actorId", name: { $first: "$actorName" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // Get most active agents
            const mostActiveAgents = await ActivityLog.aggregate([
                { $match: { ...query, actorModel: 'Agents' } },
                { $group: { _id: "$actorId", name: { $first: "$actorName" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // Get error activities
            const errorCount = await ActivityLog.countDocuments({
                ...query,
                status: 'failure'
            });

            const errorRate = totalActivities > 0 ? (errorCount / totalActivities) * 100 : 0;

            return res.status(200).json({
                success: true,
                data: {
                    totalActivities,
                    activitiesByAction: activitiesByAction.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    activitiesByActor: activitiesByActor.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    activitiesByEntity: activitiesByEntity.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    activitiesByStatus: activitiesByStatus.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    dailyActivity: formattedDailyActivity,
                    mostActiveUsers,
                    mostActiveAgents,
                    errorCount,
                    errorRate: parseFloat(errorRate.toFixed(2))
                }
            });
        } catch (error) {
            console.error("Error in getActivityLogStats:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Search activity logs
    searchActivityLogs: async (req, res) => {
        try {
            const {
                query: searchQuery,
                actorModel,
                action,
                entityType,
                status,
                startDate,
                endDate,
                adminId,
                sortBy,
                sortOrder,
                page = 1,
                limit = 20
            } = req.query;

            const actorId = req.superAdminId || req.adminId;
            const actorRole = req.superAdminId ? 'superadmin' : 'admin';

            // Build query
            const query = {};

            // Add role-based filters
            if (actorRole === 'admin') {
                query.adminId = actorId;
            } else if (adminId) {
                query.adminId = adminId;
            }

            if (actorModel) query.actorModel = actorModel;
            if (action) query.action = action;
            if (entityType) query.entityType = entityType;
            if (status) query.status = status;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search query
            if (searchQuery) {
                query.$or = [
                    { actorName: { $regex: searchQuery, $options: 'i' } },
                    { description: { $regex: searchQuery, $options: 'i' } },
                    { 'details.searchText': { $regex: searchQuery, $options: 'i' } }
                ];
            }

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
            const totalCount = await ActivityLog.countDocuments(query);

            // Execute query with pagination
            const activityLogs = await ActivityLog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: activityLogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in searchActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Export activity logs
    exportActivityLogs: async (req, res) => {
        try {
            const {
                format = 'csv',
                actorModel,
                action,
                entityType,
                status,
                startDate,
                endDate,
                adminId
            } = req.query;

            const actorId = req.superAdminId || req.adminId;
            const actorRole = req.superAdminId ? 'superadmin' : 'admin';

            // Build query
            const query = {};

            // Add role-based filters
            if (actorRole === 'admin') {
                query.adminId = actorId;
            } else if (adminId) {
                query.adminId = adminId;
            }

            if (actorModel) query.actorModel = actorModel;
            if (action) query.action = action;
            if (entityType) query.entityType = entityType;
            if (status) query.status = status;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Get activity logs
            const activityLogs = await ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .limit(10000); // Limit to prevent memory issues

            // Format data based on requested format
            if (format === 'csv') {
                // Convert to CSV format
                const csv = convertToCSV(activityLogs);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
                return res.send(csv);
            } else if (format === 'json') {
                // Return as JSON
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.json');
                return res.json(activityLogs);
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid export format. Use 'csv' or 'json'"
                });
            }
        } catch (error) {
            console.error("Error in exportActivityLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

// Helper function to convert data to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    // Define headers
    const headers = [
        'Timestamp',
        'Actor Name',
        'Actor Type',
        'Action',
        'Entity Type',
        'Entity ID',
        'Description',
        'Status',
        'IP Address',
        'Device Info'
    ];

    // Create CSV rows
    const rows = data.map(log => [
        log.createdAt.toISOString(),
        log.actorName || '',
        log.actorModel || '',
        log.action || '',
        log.entityType || '',
        log.entityId || '',
        log.description || '',
        log.status || '',
        log.ip || '',
        log.deviceInfo ? JSON.stringify(log.deviceInfo) : ''
    ]);

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

module.exports = ActivityLogController;