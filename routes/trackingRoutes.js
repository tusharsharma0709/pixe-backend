// routes/trackingRoutes.js
const express = require('express');
const router = express.Router();
const { adminAuth, userAuth } = require('../middlewares/auth');
const kycGtmService = require('../services/kycGtmServices');
const { TrackingEvent } = require('../models/trackingEvents');

// Get KYC tracking status for a user
router.get('/kyc/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const status = await kycGtmService.getKycTrackingStatus(userId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'KYC tracking status not found for this user'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC tracking status',
            error: error.message
        });
    }
});

// Get own KYC tracking status (for authenticated users)
router.get('/kyc/my-status', userAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        const status = await kycGtmService.getKycTrackingStatus(userId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'KYC tracking status not found'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC tracking status',
            error: error.message
        });
    }
});

// Get tracking events for a user
router.get('/events/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100 } = req.query;
        
        const events = await TrackingEvent.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving tracking events',
            error: error.message
        });
    }
});

// Get KYC completion statistics
router.get('/stats/kyc-completion', adminAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Build date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }
        
        // Get all KYC status update events
        const events = await TrackingEvent.find({
            event: 'kyc_status_updated',
            ...dateFilter
        });
        
        // Calculate statistics
        const totalUsers = await TrackingEvent.distinct('user_id', {
            event: 'kyc_status_updated',
            ...dateFilter
        }).countDocuments();
        
        // Initialize stats object
        const stats = {
            total_users: totalUsers,
            completed_steps: {
                aadhaar: 0,
                aadhaar_otp: 0,
                pan: 0,
                aadhaar_pan_link: 0,
                bank_account: 0
            },
            average_completion_percentage: 0,
            fully_completed_count: 0
        };
        
        // Calculate stats from events
        if (events.length > 0) {
            let totalPercentage = 0;
            
            events.forEach(event => {
                totalPercentage += event.completion_percentage || 0;
                
                if (event.data) {
                    if (event.data.isAadhaarVerified) stats.completed_steps.aadhaar++;
                    if (event.data.isAadhaarValidated) stats.completed_steps.aadhaar_otp++;
                    if (event.data.isPanVerified) stats.completed_steps.pan++;
                    if (event.data.isAadhaarPanLinked) stats.completed_steps.aadhaar_pan_link++;
                    if (event.data.isBankVerified) stats.completed_steps.bank_account++;
                    
                    // Count fully completed KYCs
                    if (event.completion_percentage === 100) {
                        stats.fully_completed_count++;
                    }
                }
            });
            
            // Calculate average completion percentage
            stats.average_completion_percentage = Math.round(totalPercentage / events.length);
            
            // Convert counts to percentages
            if (totalUsers > 0) {
                Object.keys(stats.completed_steps).forEach(key => {
                    stats.completed_steps[key] = Math.round((stats.completed_steps[key] / totalUsers) * 100);
                });
            }
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving KYC statistics',
            error: error.message
        });
    }
});

module.exports = router;