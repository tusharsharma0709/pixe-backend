// controllers/StatisticsController.js
const { Statistic } = require('../models/Statistics');
const { User } = require('../models/Users');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { Campaign } = require('../models/Campaigns');
const { Order } = require('../models/Orders');
const { Payment } = require('../models/Payments');
const { UserSession } = require('../models/UserSessions');
const { Message } = require('../models/Messages');
const { LeadAssignment } = require('../models/LeadAssignments');
const { Verification } = require('../models/Verifications');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const StatisticsController = {
    // Create or update a statistic metric
    upsertStatistic: async (req, res) => {
        try {
            const {
                entityType,
                entityId,
                metricType,
                dimension,
                dimensionValue,
                date,
                value,
                adminId,
                agentId,
                metadata
            } = req.body;

            // Validate required fields
            if (!entityType || !metricType || !value) {
                return res.status(400).json({
                    success: false,
                    message: "Entity type, metric type, and value are required"
                });
            }

            // Validate permissions based on user type
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');

            // Use Statistic model's upsertMetric method
            const statistic = await Statistic.upsertMetric({
                entityType,
                entityId,
                metricType,
                dimension: dimension || 'daily',
                dimensionValue,
                date: date || new Date(),
                value,
                adminId,
                agentId,
                metadata
            });

            return res.status(200).json({
                success: true,
                message: "Statistic upserted successfully",
                data: statistic
            });
        } catch (error) {
            console.error("Error in upsertStatistic:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get statistics for Super Admin (Platform-wide)
    getSuperAdminStatistics: async (req, res) => {
        try {
            const {
                entityType,
                metricType,
                dimension,
                startDate,
                endDate,
                adminId,
                agentId
            } = req.query;

            const query = {};

            if (entityType) query.entityType = entityType;
            if (metricType) query.metricType = metricType;
            if (dimension) query.dimension = dimension;
            if (adminId) query.adminId = adminId;
            if (agentId) query.agentId = agentId;

            // Add date range filter
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const statistics = await Statistic.find(query)
                .sort({ date: -1 })
                .limit(1000);

            // Get aggregated statistics
            const aggregatedStats = await Statistic.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            entityType: "$entityType",
                            metricType: "$metricType",
                            dimension: "$dimension"
                        },
                        totalValue: { $sum: "$value" },
                        avgValue: { $avg: "$value" },
                        minValue: { $min: "$value" },
                        maxValue: { $max: "$value" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    statistics,
                    aggregatedStats
                }
            });
        } catch (error) {
            console.error("Error in getSuperAdminStatistics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get statistics for Admin
    getAdminStatistics: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                entityType,
                metricType,
                dimension,
                startDate,
                endDate
            } = req.query;

            const query = { adminId };

            if (entityType) query.entityType = entityType;
            if (metricType) query.metricType = metricType;
            if (dimension) query.dimension = dimension;

            // Add date range filter
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const statistics = await Statistic.find(query)
                .sort({ date: -1 })
                .limit(500);

            // Get aggregated statistics for this admin
            const aggregatedStats = await Statistic.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            entityType: "$entityType",
                            metricType: "$metricType",
                            dimension: "$dimension"
                        },
                        totalValue: { $sum: "$value" },
                        avgValue: { $avg: "$value" },
                        minValue: { $min: "$value" },
                        maxValue: { $max: "$value" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    statistics,
                    aggregatedStats
                }
            });
        } catch (error) {
            console.error("Error in getAdminStatistics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get statistics for Agent
    getAgentStatistics: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                entityType,
                metricType,
                dimension,
                startDate,
                endDate
            } = req.query;

            const query = { agentId };

            if (entityType) query.entityType = entityType;
            if (metricType) query.metricType = metricType;
            if (dimension) query.dimension = dimension;

            // Add date range filter
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const statistics = await Statistic.find(query)
                .sort({ date: -1 })
                .limit(200);

            // Get aggregated statistics for this agent
            const aggregatedStats = await Statistic.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            metricType: "$metricType",
                            dimension: "$dimension"
                        },
                        totalValue: { $sum: "$value" },
                        avgValue: { $avg: "$value" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    statistics,
                    aggregatedStats
                }
            });
        } catch (error) {
            console.error("Error in getAgentStatistics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get dashboard statistics (consolidated view)
    getDashboardStatistics: async (req, res) => {
        try {
            const { period = 'daily', startDate, endDate } = req.query;
            const actorId = req.superAdminId || req.adminId || req.agentId;
            const actorRole = req.superAdminId ? 'superadmin' : (req.adminId ? 'admin' : 'agent');

            // Build base query based on role
            const baseQuery = {};
            if (actorRole === 'admin') {
                baseQuery.adminId = actorId;
            } else if (actorRole === 'agent') {
                baseQuery.agentId = actorId;
            }

            // Add date range filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.date = {};
                if (startDate) dateFilter.date.$gte = new Date(startDate);
                if (endDate) dateFilter.date.$lte = new Date(endDate);
            } else {
                // Default to last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                dateFilter.date = { $gte: thirtyDaysAgo };
            }

            const finalQuery = { ...baseQuery, ...dateFilter };

            // Get key metrics
            const keyMetrics = await Statistic.aggregate([
                { $match: finalQuery },
                {
                    $group: {
                        _id: "$metricType",
                        totalValue: { $sum: "$value" },
                        avgValue: { $avg: "$value" },
                        latestValue: { $last: "$value" },
                        changePercentage: { $last: "$changePercentage" }
                    }
                }
            ]);

            // Get trend data
            const trendData = await Statistic.aggregate([
                { $match: { ...finalQuery, dimension: period } },
                { $sort: { date: 1 } },
                {
                    $group: {
                        _id: {
                            metricType: "$metricType",
                            date: "$date"
                        },
                        value: { $sum: "$value" }
                    }
                },
                {
                    $group: {
                        _id: "$_id.metricType",
                        data: {
                            $push: {
                                date: "$_id.date",
                                value: "$value"
                            }
                        }
                    }
                }
            ]);

            // Get entity breakdown
            const entityBreakdown = await Statistic.aggregate([
                { $match: finalQuery },
                {
                    $group: {
                        _id: {
                            entityType: "$entityType",
                            metricType: "$metricType"
                        },
                        totalValue: { $sum: "$value" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Get real-time counts from collections
            let realTimeCounts = {};

            if (actorRole === 'superadmin') {
                realTimeCounts = {
                    totalAdmins: await Admin.countDocuments(),
                    activeAdmins: await Admin.countDocuments({ status: true }),
                    totalAgents: await Agent.countDocuments(),
                    activeAgents: await Agent.countDocuments({ status: true, isOnline: true }),
                    totalUsers: await User.countDocuments(),
                    totalCampaigns: await Campaign.countDocuments(),
                    activeCampaigns: await Campaign.countDocuments({ status: 'active' })
                };
            } else if (actorRole === 'admin') {
                realTimeCounts = {
                    totalAgents: await Agent.countDocuments({ adminId: actorId }),
                    activeAgents: await Agent.countDocuments({ adminId: actorId, status: true, isOnline: true }),
                    totalUsers: await User.countDocuments({ adminId: actorId }),
                    totalCampaigns: await Campaign.countDocuments({ adminId: actorId }),
                    activeCampaigns: await Campaign.countDocuments({ adminId: actorId, status: 'active' })
                };
            } else if (actorRole === 'agent') {
                const leadAssignments = await LeadAssignment.find({ agentId: actorId, status: 'active' });
                const userIds = leadAssignments.map(la => la.userId);
                
                realTimeCounts = {
                    assignedLeads: leadAssignments.length,
                    totalMessages: await Message.countDocuments({ agentId: actorId }),
                    activeSessions: await UserSession.countDocuments({ agentId: actorId, status: 'active' })
                };
            }

            return res.status(200).json({
                success: true,
                data: {
                    keyMetrics,
                    trendData,
                    entityBreakdown,
                    realTimeCounts
                }
            });
        } catch (error) {
            console.error("Error in getDashboardStatistics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Record campaign metrics
    recordCampaignMetrics: async (req, res) => {
        try {
            const { campaignId, metrics } = req.body;
            const adminId = req.adminId;

            // Validate campaign ownership
            const campaign = await Campaign.findOne({ _id: campaignId, adminId });
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: "Campaign not found or you don't have permission"
                });
            }

            // Prepare statistics to record
            const metricsToRecord = [];
            const date = new Date();

            // Process each metric
            for (const [metricType, value] of Object.entries(metrics)) {
                metricsToRecord.push({
                    entityType: 'campaign',
                    entityId: campaignId,
                    metricType: `campaign_${metricType}`,
                    dimension: 'daily',
                    date,
                    value,
                    adminId,
                    source: 'facebook'
                });
            }

            // Use bulkWrite for efficiency
            const bulkOps = metricsToRecord.map(metric => ({
                updateOne: {
                    filter: {
                        entityType: metric.entityType,
                        entityId: metric.entityId,
                        metricType: metric.metricType,
                        dimension: metric.dimension,
                        date: metric.date
                    },
                    update: { $set: metric },
                    upsert: true
                }
            }));

            await Statistic.bulkWrite(bulkOps);

            return res.status(200).json({
                success: true,
                message: "Campaign metrics recorded successfully",
                data: {
                    campaignId,
                    metricsRecorded: Object.keys(metrics).length
                }
            });
        } catch (error) {
            console.error("Error in recordCampaignMetrics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get comparison statistics
    getComparisonStatistics: async (req, res) => {
        try {
            const {
                entityType,
                metricType,
                dimension = 'daily',
                compareWith = 'previous_period',
                startDate,
                endDate
            } = req.query;

            const actorId = req.superAdminId || req.adminId;
            const actorRole = req.superAdminId ? 'superadmin' : 'admin';

            // Build base query
            const baseQuery = {
                entityType,
                metricType,
                dimension
            };

            if (actorRole === 'admin') {
                baseQuery.adminId = actorId;
            }

            // Current period
            const currentPeriodQuery = { ...baseQuery };
            if (startDate && endDate) {
                currentPeriodQuery.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            // Previous period calculation
            let previousPeriodQuery = { ...baseQuery };
            if (compareWith === 'previous_period' && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const periodLength = end - start;
                
                previousPeriodQuery.date = {
                    $gte: new Date(start - periodLength),
                    $lt: start
                };
            }

            // Get statistics for both periods
            const [currentPeriodStats, previousPeriodStats] = await Promise.all([
                Statistic.aggregate([
                    { $match: currentPeriodQuery },
                    {
                        $group: {
                            _id: null,
                            totalValue: { $sum: "$value" },
                            avgValue: { $avg: "$value" },
                            count: { $sum: 1 }
                        }
                    }
                ]),
                Statistic.aggregate([
                    { $match: previousPeriodQuery },
                    {
                        $group: {
                            _id: null,
                            totalValue: { $sum: "$value" },
                            avgValue: { $avg: "$value" },
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            // Calculate comparison metrics
            const current = currentPeriodStats[0] || { totalValue: 0, avgValue: 0, count: 0 };
            const previous = previousPeriodStats[0] || { totalValue: 0, avgValue: 0, count: 0 };

            const comparison = {
                current,
                previous,
                change: {
                    absolute: current.totalValue - previous.totalValue,
                    percentage: previous.totalValue ? 
                        ((current.totalValue - previous.totalValue) / previous.totalValue) * 100 : 0
                }
            };

            return res.status(200).json({
                success: true,
                data: comparison
            });
        } catch (error) {
            console.error("Error in getComparisonStatistics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Export statistics data
    exportStatistics: async (req, res) => {
        try {
            const {
                format = 'csv',
                entityType,
                metricType,
                startDate,
                endDate
            } = req.query;

            const actorId = req.superAdminId || req.adminId;
            const actorRole = req.superAdminId ? 'superadmin' : 'admin';

            // Build query
            const query = {};
            if (entityType) query.entityType = entityType;
            if (metricType) query.metricType = metricType;

            if (actorRole === 'admin') {
                query.adminId = actorId;
            }

            // Add date range filter
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            // Get statistics
            const statistics = await Statistic.find(query)
                .sort({ date: -1 })
                .limit(5000); // Limit to prevent memory issues

            // Format data based on requested format
            if (format === 'csv') {
                const csv = convertToCSV(statistics);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=statistics.csv');
                return res.send(csv);
            } else if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=statistics.json');
                return res.json(statistics);
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid export format. Use 'csv' or 'json'"
                });
            }
        } catch (error) {
            console.error("Error in exportStatistics:", error);
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
        'Date',
        'Entity Type',
        'Entity ID',
        'Metric Type',
        'Dimension',
        'Dimension Value',
        'Value',
        'Previous Value',
        'Change Percentage',
        'Admin ID',
        'Agent ID',
        'Source'
    ];

    // Create CSV rows
    const rows = data.map(stat => [
        stat.date.toISOString(),
        stat.entityType || '',
        stat.entityId || '',
        stat.metricType || '',
        stat.dimension || '',
        stat.dimensionValue || '',
        stat.value || 0,
        stat.previousValue || 0,
        stat.changePercentage || 0,
        stat.adminId || '',
        stat.agentId || '',
        stat.source || ''
    ]);

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

module.exports = StatisticsController;