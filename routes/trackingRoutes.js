// routes/trackingRoutes.js - Complete updated tracking routes using unified service
const express = require('express');
const router = express.Router();
const { adminAuth, userAuth } = require('../middlewares/auth');
const mongoose = require('mongoose');

// UPDATED: Import unified service instead of old KYC service
const unifiedGtmService = require('../services/gtmTrackingServices');

// UPDATED: Use unified tracking events model
const UnifiedTrackingEvent = mongoose.model('UnifiedTrackingEvents');

// LEGACY SUPPORT: If you still need the old TrackingEvent model
// const { TrackingEvent } = require('../models/trackingEvents');

// Get KYC tracking status for a user (UPDATED)
router.get('/kyc/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // UPDATED: Get KYC status from unified tracking events
        const kycEvents = await UnifiedTrackingEvent.find({
            user_id: userId,
            event_category: 'kyc'
        }).sort({ timestamp: -1 });
        
        if (!kycEvents || kycEvents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'KYC tracking status not found for this user'
            });
        }
        
        // Build KYC status from events
        const kycStatus = {
            user_id: userId,
            steps: {},
            overall_completion: 0,
            last_updated: null
        };
        
        // Process KYC events to build status
        kycEvents.forEach(event => {
            if (event.kyc_step) {
                kycStatus.steps[event.kyc_step] = {
                    completed: event.success,
                    timestamp: event.timestamp,
                    execution_time_ms: event.execution_time_ms || 0
                };
            }
            
            if (event.completion_percentage) {
                kycStatus.overall_completion = Math.max(
                    kycStatus.overall_completion, 
                    event.completion_percentage
                );
            }
            
            if (!kycStatus.last_updated || event.timestamp > kycStatus.last_updated) {
                kycStatus.last_updated = event.timestamp;
            }
        });
        
        res.json({
            success: true,
            data: kycStatus
        });
    } catch (error) {
        console.error('Error retrieving KYC tracking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC tracking status',
            error: error.message
        });
    }
});

// Get own KYC tracking status (UPDATED)
router.get('/kyc/my-status', userAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        // UPDATED: Get user's KYC status from unified events
        const kycEvents = await UnifiedTrackingEvent.find({
            user_id: userId,
            event_category: 'kyc'
        }).sort({ timestamp: -1 });
        
        if (!kycEvents || kycEvents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'KYC tracking status not found'
            });
        }
        
        // Build simplified status for user
        const userStatus = {
            steps_completed: [],
            overall_progress: 0,
            last_activity: null
        };
        
        kycEvents.forEach(event => {
            if (event.kyc_step && event.success) {
                if (!userStatus.steps_completed.includes(event.kyc_step)) {
                    userStatus.steps_completed.push(event.kyc_step);
                }
            }
            
            if (event.completion_percentage) {
                userStatus.overall_progress = Math.max(
                    userStatus.overall_progress, 
                    event.completion_percentage
                );
            }
            
            if (!userStatus.last_activity || event.timestamp > userStatus.last_activity) {
                userStatus.last_activity = event.timestamp;
            }
        });
        
        res.json({
            success: true,
            data: userStatus
        });
    } catch (error) {
        console.error('Error retrieving user KYC status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC tracking status',
            error: error.message
        });
    }
});

// Get tracking events for a user (UPDATED)
router.get('/events/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100, eventCategory, eventType, startDate, endDate } = req.query;
        
        // Build query filters
        const query = { user_id: userId };
        
        if (eventCategory) {
            query.event_category = eventCategory;
        }
        
        if (eventType) {
            query.event_type = eventType;
        }
        
        // Add date filters
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        // UPDATED: Get events from unified collection
        const events = await UnifiedTrackingEvent.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        // Get event summary
        const eventSummary = events.reduce((acc, event) => {
            const category = event.event_category || 'unknown';
            const type = event.event_type || 'unknown';
            
            if (!acc[category]) acc[category] = {};
            if (!acc[category][type]) acc[category][type] = 0;
            acc[category][type]++;
            
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: {
                events,
                summary: {
                    total_events: events.length,
                    breakdown: eventSummary,
                    user_id: userId
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving tracking events:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving tracking events',
            error: error.message
        });
    }
});

// Get comprehensive completion statistics (UPDATED and ENHANCED)
router.get('/stats/completion', adminAuth, async (req, res) => {
    try {
        const { startDate, endDate, category = 'all' } = req.query;
        
        // Build date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
        }
        
        // Build category filter
        const categoryFilter = {};
        if (category !== 'all') {
            categoryFilter.event_category = category;
        }
        
        // Combine filters
        const query = { ...dateFilter, ...categoryFilter };
        
        // Get workflow completion stats
        const workflowStats = await UnifiedTrackingEvent.aggregate([
            { $match: { ...query, event_type: { $in: ['workflow_complete', 'kyc_workflow_complete'] } } },
            {
                $group: {
                    _id: '$workflow_name',
                    total_completions: { $sum: 1 },
                    avg_completion_percentage: { $avg: '$completion_percentage' },
                    avg_execution_time: { $avg: '$execution_time_ms' }
                }
            },
            { $sort: { total_completions: -1 } }
        ]);
        
        // Get KYC-specific stats
        const kycStats = await UnifiedTrackingEvent.aggregate([
            { $match: { ...query, event_category: 'kyc' } },
            {
                $group: {
                    _id: '$kyc_step',
                    total_attempts: { $sum: 1 },
                    successful_attempts: { $sum: { $cond: ['$success', 1, 0] } },
                    avg_execution_time: { $avg: '$execution_time_ms' }
                }
            },
            {
                $addFields: {
                    success_rate: { $divide: ['$successful_attempts', '$total_attempts'] }
                }
            },
            { $sort: { total_attempts: -1 } }
        ]);
        
        // Get user interaction stats
        const interactionStats = await UnifiedTrackingEvent.aggregate([
            { $match: { ...query, event_category: 'user_interaction' } },
            {
                $group: {
                    _id: '$input_variable',
                    total_inputs: { $sum: 1 },
                    unique_users: { $addToSet: '$user_id' }
                }
            },
            {
                $addFields: {
                    unique_user_count: { $size: '$unique_users' }
                }
            },
            { $sort: { total_inputs: -1 } }
        ]);
        
        // Get overall stats
        const totalEvents = await UnifiedTrackingEvent.countDocuments(query);
        const uniqueUsers = await UnifiedTrackingEvent.distinct('user_id', query);
        const uniqueSessions = await UnifiedTrackingEvent.distinct('session_id', query);
        
        // Calculate time-based stats
        const dailyStats = await UnifiedTrackingEvent.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        
        // Format daily stats
        const formattedDailyStats = dailyStats.map(item => ({
            date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
            count: item.count
        }));
        
        res.json({
            success: true,
            data: {
                overview: {
                    total_events: totalEvents,
                    unique_users: uniqueUsers.length,
                    unique_sessions: uniqueSessions.length,
                    date_range: { startDate, endDate },
                    category_filter: category
                },
                workflow_completions: workflowStats,
                kyc_performance: kycStats,
                user_interactions: interactionStats,
                daily_activity: formattedDailyStats
            }
        });
    } catch (error) {
        console.error('Error retrieving completion statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving completion statistics',
            error: error.message
        });
    }
});

// NEW: Get real-time dashboard data
router.get('/dashboard/realtime', adminAuth, async (req, res) => {
    try {
        // Get events from last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const recentEvents = await UnifiedTrackingEvent.find({
            timestamp: { $gte: last24Hours }
        })
        .sort({ timestamp: -1 })
        .limit(50);
        
        // Get active sessions (events in last hour)
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);
        const activeSessions = await UnifiedTrackingEvent.distinct('session_id', {
            timestamp: { $gte: lastHour }
        });
        
        // Get event counts by category
        const eventCounts = await UnifiedTrackingEvent.aggregate([
            { $match: { timestamp: { $gte: last24Hours } } },
            { $group: { _id: '$event_category', count: { $sum: 1 } } }
        ]);
        
        // Get SurePass API performance
        const surePassStats = await UnifiedTrackingEvent.aggregate([
            { 
                $match: { 
                    timestamp: { $gte: last24Hours },
                    event_category: 'kyc',
                    'metadata.is_surepass_api': true
                }
            },
            {
                $group: {
                    _id: '$kyc_step',
                    total_calls: { $sum: 1 },
                    successful_calls: { $sum: { $cond: ['$success', 1, 0] } },
                    avg_response_time: { $avg: '$response_time_ms' }
                }
            },
            {
                $addFields: {
                    success_rate: { $divide: ['$successful_calls', '$total_calls'] }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                recent_events: recentEvents,
                active_sessions_count: activeSessions.length,
                event_counts: eventCounts.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                surepass_performance: surePassStats,
                last_updated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error retrieving realtime dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving realtime dashboard data',
            error: error.message
        });
    }
});

// NEW: Get analytics data for unified tracking
router.get('/analytics/:workflowId', adminAuth, async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { startDate, endDate } = req.query;
        
        // UPDATED: Use unified analytics function
        const analytics = await unifiedGtmService.getUnifiedAnalytics(workflowId, startDate, endDate);
        
        if (!analytics) {
            return res.status(404).json({
                success: false,
                message: 'No analytics data found for this workflow'
            });
        }
        
        res.json({
            success: true,
            data: {
                workflow_id: workflowId,
                analytics,
                date_range: { startDate, endDate }
            }
        });
    } catch (error) {
        console.error('Error retrieving workflow analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving workflow analytics',
            error: error.message
        });
    }
});

// NEW: Get SurePass specific analytics
router.get('/surepass/analytics', adminAuth, async (req, res) => {
    try {
        const { startDate, endDate, step } = req.query;
        
        // Build date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
        }
        
        // Build query for SurePass events
        const query = {
            event_category: 'kyc',
            'metadata.verification_provider': 'surepass',
            ...dateFilter
        };
        
        if (step) {
            query.kyc_step = step;
        }
        
        // Get SurePass performance metrics
        const performanceStats = await UnifiedTrackingEvent.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$kyc_step',
                    total_attempts: { $sum: 1 },
                    successful_attempts: { $sum: { $cond: ['$success', 1, 0] } },
                    avg_execution_time: { $avg: '$execution_time_ms' },
                    min_execution_time: { $min: '$execution_time_ms' },
                    max_execution_time: { $max: '$execution_time_ms' }
                }
            },
            {
                $addFields: {
                    success_rate: { $divide: ['$successful_attempts', '$total_attempts'] },
                    failure_rate: { 
                        $divide: [
                            { $subtract: ['$total_attempts', '$successful_attempts'] }, 
                            '$total_attempts'
                        ]
                    }
                }
            },
            { $sort: { total_attempts: -1 } }
        ]);
        
        // Get error analysis
        const errorAnalysis = await UnifiedTrackingEvent.aggregate([
            { $match: { ...query, success: false } },
            {
                $group: {
                    _id: '$error_message',
                    count: { $sum: 1 },
                    affected_steps: { $addToSet: '$kyc_step' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Get usage trends over time
        const usageTrends = await UnifiedTrackingEvent.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' },
                        step: '$kyc_step'
                    },
                    count: { $sum: 1 },
                    success_count: { $sum: { $cond: ['$success', 1, 0] } }
                }
            },
            {
                $group: {
                    _id: {
                        year: '$_id.year',
                        month: '$_id.month',
                        day: '$_id.day'
                    },
                    steps: {
                        $push: {
                            step: '$_id.step',
                            total: '$count',
                            successful: '$success_count'
                        }
                    },
                    daily_total: { $sum: '$count' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        
        res.json({
            success: true,
            data: {
                performance_stats: performanceStats,
                error_analysis: errorAnalysis,
                usage_trends: usageTrends,
                date_range: { startDate, endDate },
                step_filter: step || 'all'
            }
        });
    } catch (error) {
        console.error('Error retrieving SurePass analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving SurePass analytics',
            error: error.message
        });
    }
});

// LEGACY: Keep old KYC stats endpoint for backward compatibility
router.get('/stats/kyc-completion', adminAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Redirect to new unified stats endpoint
        console.log('⚠️ Using deprecated endpoint. Use /stats/completion?category=kyc instead.');
        
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
        }
        
        const kycStats = await UnifiedTrackingEvent.aggregate([
            { $match: { ...dateFilter, event_category: 'kyc' } },
            {
                $group: {
                    _id: '$kyc_step',
                    total_attempts: { $sum: 1 },
                    successful_attempts: { $sum: { $cond: ['$success', 1, 0] } }
                }
            }
        ]);
        
        // Format in old format for compatibility
        const legacyStats = {
            total_users: await UnifiedTrackingEvent.distinct('user_id', { ...dateFilter, event_category: 'kyc' }).then(arr => arr.length),
            completed_steps: {},
            average_completion_percentage: 0,
            fully_completed_count: 0
        };
        
        kycStats.forEach(stat => {
            if (stat._id) {
                legacyStats.completed_steps[stat._id] = Math.round((stat.successful_attempts / stat.total_attempts) * 100);
            }
        });
        
        res.json({
            success: true,
            data: legacyStats,
            note: 'This endpoint is deprecated. Use /stats/completion?category=kyc instead.'
        });
    } catch (error) {
        console.error('Error retrieving legacy KYC statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC statistics',
            error: error.message
        });
    }
});

// NEW: Manual event tracking endpoint (for testing or manual triggers)
router.post('/manual-event', adminAuth, async (req, res) => {
    try {
        const { event_type, event_category, ...eventData } = req.body;
        
        if (!event_type || !event_category) {
            return res.status(400).json({
                success: false,
                message: 'event_type and event_category are required'
            });
        }
        
        // Track the manual event
        const result = await unifiedGtmService.trackEvent({
            event_type,
            event_category,
            user_id: req.adminId, // Use admin ID as user ID for manual events
            success: true,
            metadata: {
                manual_trigger: true,
                triggered_by: req.adminId,
                ...eventData
            }
        });
        
        res.json({
            success: true,
            message: 'Manual event tracked successfully',
            data: result
        });
    } catch (error) {
        console.error('Error tracking manual event:', error);
        res.status(500).json({
            success: false,
            message: 'Error tracking manual event',
            error: error.message
        });
    }
});

module.exports = router;