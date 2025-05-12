// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Get all reports (admins and super admins only)
router.get('/', adminAuth, ReportController.getAllReports);

// Get report by ID (admins and super admins only)
router.get('/:id', adminAuth, ReportController.getReport);

// Create new report (admins and super admins only)
router.post('/', adminAuth, ReportController.createReport);

// Download report (admins and super admins only)
router.get('/:id/download', adminAuth, ReportController.downloadReport);

// Share report (admins and super admins only)
router.post('/:id/share', adminAuth, ReportController.shareReport);

// Delete report (admins and super admins only)
router.delete('/:id', adminAuth, ReportController.deleteReport);

// Report templates - predefined report configurations
router.get('/templates/:type', adminAuth, async (req, res) => {
    const { type } = req.params;
    
    // Define report templates
    const templates = {
        campaign_performance: {
            name: 'Campaign Performance Report',
            description: 'Analyze campaign metrics including impressions, clicks, and conversions',
            type: 'campaign_performance',
            filters: {
                dateRange: 'last_30_days',
                groupBy: 'campaign'
            }
        },
        agent_performance: {
            name: 'Agent Performance Report',
            description: 'Evaluate agent metrics including response time and conversion rates',
            type: 'agent_performance',
            filters: {
                dateRange: 'last_7_days',
                groupBy: 'agent'
            }
        },
        sales_report: {
            name: 'Sales Report',
            description: 'Overview of orders, revenue, and payment metrics',
            type: 'sales_report',
            filters: {
                dateRange: 'last_month',
                groupBy: 'day'
            }
        },
        lead_conversion: {
            name: 'Lead Conversion Report',
            description: 'Track lead progression and conversion rates',
            type: 'lead_conversion',
            filters: {
                dateRange: 'last_30_days',
                groupBy: 'status'
            }
        }
    };
    
    if (type && templates[type]) {
        res.status(200).json({
            status: 'success',
            data: {
                template: templates[type]
            }
        });
    } else if (!type) {
        res.status(200).json({
            status: 'success',
            data: {
                templates: Object.values(templates)
            }
        });
    } else {
        res.status(404).json({
            status: 'error',
            message: 'Template not found'
        });
    }
});

// Schedule report (admins and super admins only)
router.post('/schedule', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { reportConfig, schedule } = req.body;
    
    // Create a scheduled report
    const report = await Report.create({
        ...reportConfig,
        schedule: {
            frequency: schedule.frequency,
            nextRun: schedule.startDate,
            isActive: true
        },
        adminId: userType === 'admin' ? userId : reportConfig.adminId,
        superAdminId: userType === 'superadmin' ? userId : null,
        status: 'scheduled'
    });
    
    res.status(201).json({
        status: 'success',
        data: {
            report
        }
    });
});

// Update scheduled report (admins and super admins only)
router.put('/schedule/:id', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    const { schedule } = req.body;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to update this report', 403));
    }
    
    report.schedule = {
        ...report.schedule,
        ...schedule
    };
    
    await report.save();
    
    res.status(200).json({
        status: 'success',
        data: {
            report
        }
    });
});

// Cancel scheduled report (admins and super admins only)
router.put('/schedule/:id/cancel', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to cancel this report', 403));
    }
    
    report.schedule.isActive = false;
    report.status = 'cancelled';
    
    await report.save();
    
    res.status(200).json({
        status: 'success',
        data: {
            report
        }
    });
});

// Export report data (admins and super admins only)
router.post('/:id/export', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    const { format } = req.body;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to export this report', 403));
    }
    
    // Generate export based on format
    let exportUrl;
    switch (format) {
        case 'pdf':
            exportUrl = await ReportController.generatePDFReport(report);
            break;
        case 'xlsx':
            exportUrl = await ReportController.generateExcelReport(report);
            break;
        case 'csv':
            exportUrl = await ReportController.generateCSVReport(report);
            break;
        default:
            return next(new AppError('Invalid export format', 400));
    }
    
    res.status(200).json({
        status: 'success',
        data: {
            exportUrl
        }
    });
});

// Real-time report data (admins and super admins only)
router.get('/realtime/:type', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { type } = req.params;
    const { filters = {} } = req.query;
    
    // Add user filters
    if (userType === 'admin') {
        filters.adminId = userId;
    }
    
    // Get real-time data based on type
    let data;
    switch (type) {
        case 'campaign_metrics':
            data = await Statistic.find({
                entityType: 'campaign',
                date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
                ...filters
            }).sort({ date: -1 });
            break;
            
        case 'agent_activity':
            data = await Statistic.find({
                entityType: 'agent',
                date: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
                ...filters
            }).sort({ date: -1 });
            break;
            
        case 'order_status':
            data = await Order.find({
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                ...filters
            }).sort({ createdAt: -1 }).select('orderNumber status totalAmount');
            break;
            
        default:
            return next(new AppError('Invalid real-time report type', 400));
    }
    
    res.status(200).json({
        status: 'success',
        data: {
            type,
            data,
            timestamp: new Date()
        }
    });
});

// Compare reports (admins and super admins only)
router.get('/compare', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { reportIds } = req.query;
    
    if (!reportIds || reportIds.length < 2) {
        return next(new AppError('At least two report IDs required for comparison', 400));
    }
    
    const reports = await Report.find({
        _id: { $in: reportIds }
    });
    
    // Check permissions for all reports
    for (const report of reports) {
        if (userType === 'admin' && report.adminId?.toString() !== userId) {
            const isShared = report.sharedWith.some(
                share => share.userId.toString() === userId && share.type === 'admin'
            );
            if (!isShared) {
                return next(new AppError(`Not authorized to access report ${report._id}`, 403));
            }
        }
    }
    
    // Compare reports (simplified comparison logic)
    const comparison = {
        reports: reports.map(r => ({
            id: r._id,
            name: r.name,
            type: r.type,
            dateRange: r.dateRange,
            metrics: r.metrics
        })),
        differences: {
            // Add comparison logic here
        }
    };
    
    res.status(200).json({
        status: 'success',
        data: {
            comparison
        }
    });
});

// Get report summary (admins and super admins only)
router.get('/:id/summary', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        const isShared = report.sharedWith.some(
            share => share.userId.toString() === userId && share.type === 'admin'
        );
        if (!isShared) {
            return next(new AppError('Not authorized to view this report', 403));
        }
    }
    
    // Generate summary
    const summary = {
        id: report._id,
        name: report.name,
        type: report.type,
        status: report.status,
        createdAt: report.createdAt,
        dateRange: report.dateRange,
        keyMetrics: report.metrics.slice(0, 4), // Top 4 metrics
        totalDataPoints: report.data ? Object.keys(report.data).length : 0
    };
    
    res.status(200).json({
        status: 'success',
        data: {
            summary
        }
    });
});

// Duplicate report (admins and super admins only)
router.post('/:id/duplicate', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    const { name } = req.body;
    
    const originalReport = await Report.findById(id);
    
    if (!originalReport) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && originalReport.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to duplicate this report', 403));
    }
    
    // Create duplicate
    const duplicateData = originalReport.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    const duplicate = await Report.create({
        ...duplicateData,
        name: name || `${originalReport.name} (Copy)`,
        status: 'draft',
        adminId: userType === 'admin' ? userId : originalReport.adminId,
        superAdminId: userType === 'superadmin' ? userId : null
    });
    
    res.status(201).json({
        status: 'success',
        data: {
            report: duplicate
        }
    });
});

// Archive report (admins and super admins only)
router.put('/:id/archive', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to archive this report', 403));
    }
    
    report.status = 'archived';
    await report.save();
    
    res.status(200).json({
        status: 'success',
        data: {
            report
        }
    });
});

// Get report insights (admins and super admins only)
router.get('/:id/insights', adminAuth, async (req, res, next) => {
    const { userType, userId } = req;
    const { id } = req.params;
    
    const report = await Report.findById(id);
    
    if (!report) {
        return next(new AppError('Report not found', 404));
    }
    
    // Check permission
    if (userType === 'admin' && report.adminId?.toString() !== userId) {
        return next(new AppError('Not authorized to view report insights', 403));
    }
    
    // Generate insights based on report data
    const insights = [];
    
    // Example insights based on report type
    if (report.type === 'campaign_performance') {
        const clickThroughRate = report.metrics.find(m => m.name === 'Click-Through Rate');
        if (clickThroughRate && parseFloat(clickThroughRate.value) < 2) {
            insights.push({
                type: 'warning',
                message: 'Your click-through rate is below industry average. Consider updating your ad creatives.',
                metric: 'Click-Through Rate',
                currentValue: clickThroughRate.value,
                benchmark: '2-3%'
            });
        }
    }
    
    res.status(200).json({
        status: 'success',
        data: {
            insights
        }
    });
});

module.exports = router;