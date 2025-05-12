// controllers/ReportController.js
const { Report } = require('../models/Reports');
const { Statistic } = require('../models/Statistics');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { Campaign } = require('../models/Campaigns');
const { Agent } = require('../models/Agents');
const { Order } = require('../models/Orders');
const { Payment } = require('../models/Payments');
const { User } = require('../models/Users');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

const ReportController = {
    // Get all reports
    getAllReports: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { type, status, dateRange, page = 1, limit = 10 } = req.query;
            
            let query = {};
            
            // Role-based access
            if (userType === 'superadmin') {
                // Super admin can see all reports
                if (req.query.adminId) {
                    query.adminId = req.query.adminId;
                }
            } else if (userType === 'admin') {
                query.adminId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view reports'
                });
            }
            
            // Apply filters
            if (type) query.type = type;
            if (status) query.status = status;
            
            if (dateRange) {
                const [startDate, endDate] = dateRange.split(',');
                query.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }
            
            const skip = (page - 1) * limit;
            
            const reports = await Report.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('adminId', 'first_name last_name email_id')
                .populate('superAdminId', 'first_name last_name email_id');
                
            const total = await Report.countDocuments(query);
            
            return res.status(200).json({
                success: true,
                data: {
                    reports,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error("Error in getAllReports:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get report by ID
    getReport: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const report = await Report.findById(id)
                .populate('adminId', 'first_name last_name email_id')
                .populate('superAdminId', 'first_name last_name email_id');
                
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Report not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && report.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this report'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    report
                }
            });
        } catch (error) {
            console.error("Error in getReport:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Create new report
    createReport: async (req, res) => {
        try {
            const { userType, userId } = req;
            const reportData = req.body;
            
            // Validate date range
            if (!reportData.dateRange?.start || !reportData.dateRange?.end) {
                return res.status(400).json({
                    success: false,
                    message: 'Date range is required'
                });
            }
            
            // Set creator based on user type
            if (userType === 'superadmin') {
                reportData.superAdminId = userId;
            } else if (userType === 'admin') {
                reportData.adminId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to create reports'
                });
            }
            
            // Generate report data based on type
            try {
                const generatedData = await ReportController.generateReportData(reportData);
                reportData.data = generatedData.data;
                reportData.metrics = generatedData.metrics;
                reportData.dimensions = generatedData.dimensions;
                reportData.status = 'running';
                
                const report = await Report.create(reportData);
                
                // Process report generation asynchronously
                ReportController.processReportGeneration(report._id);
                
                return res.status(201).json({
                    success: true,
                    data: {
                        report
                    }
                });
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: `Failed to create report: ${error.message}`
                });
            }
        } catch (error) {
            console.error("Error in createReport:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Generate report data based on type
    generateReportData: async (reportData) => {
        const { type, dateRange, filters = {} } = reportData;
        
        let data = {};
        let metrics = [];
        let dimensions = [];
        
        switch (type) {
            case 'campaign_performance':
                const campaignData = await ReportController.getCampaignPerformanceData(dateRange, filters);
                data = campaignData.data;
                metrics = campaignData.metrics;
                dimensions = campaignData.dimensions;
                break;
                
            case 'agent_performance':
                const agentData = await ReportController.getAgentPerformanceData(dateRange, filters);
                data = agentData.data;
                metrics = agentData.metrics;
                dimensions = agentData.dimensions;
                break;
                
            case 'lead_conversion':
                const leadData = await ReportController.getLeadConversionData(dateRange, filters);
                data = leadData.data;
                metrics = leadData.metrics;
                dimensions = leadData.dimensions;
                break;
                
            case 'sales_report':
                const salesData = await ReportController.getSalesReportData(dateRange, filters);
                data = salesData.data;
                metrics = salesData.metrics;
                dimensions = salesData.dimensions;
                break;
                
            case 'workflow_analytics':
                const workflowData = await ReportController.getWorkflowAnalyticsData(dateRange, filters);
                data = workflowData.data;
                metrics = workflowData.metrics;
                dimensions = workflowData.dimensions;
                break;
                
            default:
                throw new Error('Invalid report type');
        }
        
        return { data, metrics, dimensions };
    },
    
    // Get campaign performance data
    getCampaignPerformanceData: async (dateRange, filters) => {
        const query = {
            date: {
                $gte: new Date(dateRange.start),
                $lte: new Date(dateRange.end)
            },
            entityType: 'campaign'
        };
        
        if (filters.campaignId) query.entityId = filters.campaignId;
        if (filters.adminId) query.adminId = filters.adminId;
        
        const statistics = await Statistic.find(query);
        const campaigns = await Campaign.find(filters.campaignId ? { _id: filters.campaignId } : {});
        
        // Aggregate data
        const impressions = statistics.reduce((sum, stat) => 
            stat.metricType === 'campaign_impressions' ? sum + stat.value : sum, 0
        );
        const clicks = statistics.reduce((sum, stat) => 
            stat.metricType === 'campaign_clicks' ? sum + stat.value : sum, 0
        );
        const leads = statistics.reduce((sum, stat) => 
            stat.metricType === 'campaign_leads' ? sum + stat.value : sum, 0
        );
        
        const metrics = [
            {
                name: 'Total Impressions',
                value: impressions
            },
            {
                name: 'Total Clicks',
                value: clicks
            },
            {
                name: 'Total Leads',
                value: leads
            },
            {
                name: 'Click-Through Rate',
                value: impressions ? ((clicks / impressions) * 100).toFixed(2) : 0
            }
        ];
        
        const data = {
            campaigns: campaigns.map(campaign => ({
                id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                metrics: campaign.metrics
            })),
            dailyMetrics: statistics.filter(stat => stat.dimension === 'daily')
        };
        
        const dimensions = [
            {
                name: 'campaigns',
                values: campaigns.map(c => ({ id: c._id, name: c.name }))
            }
        ];
        
        return { data, metrics, dimensions };
    },
    
    // Get agent performance data
    getAgentPerformanceData: async (dateRange, filters) => {
        const query = {
            date: {
                $gte: new Date(dateRange.start),
                $lte: new Date(dateRange.end)
            },
            entityType: 'agent'
        };
        
        if (filters.agentId) query.entityId = filters.agentId;
        if (filters.adminId) query.adminId = filters.adminId;
        
        const statistics = await Statistic.find(query);
        const agents = await Agent.find(filters.agentId ? { _id: filters.agentId } : {});
        
        const responseTimeStats = statistics.filter(s => s.metricType === 'agent_response_time');
        const avgResponseTime = responseTimeStats.length ? 
            responseTimeStats.reduce((sum, stat) => sum + stat.value, 0) / responseTimeStats.length : 0;
            
        const metrics = [
            {
                name: 'Average Response Time',
                value: avgResponseTime
            },
            {
                name: 'Total Messages',
                value: statistics.reduce((sum, stat) => 
                    stat.metricType === 'agent_messages' ? sum + stat.value : sum, 0
                )
            },
            {
                name: 'Total Conversions',
                value: statistics.reduce((sum, stat) => 
                    stat.metricType === 'agent_conversions' ? sum + stat.value : sum, 0
                )
            }
        ];
        
        const data = {
            agents: agents.map(agent => ({
                id: agent._id,
                name: `${agent.first_name} ${agent.last_name}`,
                performance: agent.performance,
               currentLeadCount: agent.currentLeadCount
           })),
           dailyMetrics: statistics.filter(stat => stat.dimension === 'daily')
       };
       
       const dimensions = [
           {
               name: 'agents',
               values: agents.map(a => ({ id: a._id, name: `${a.first_name} ${a.last_name}` }))
           }
       ];
       
       return { data, metrics, dimensions };
   },
   
   // Get lead conversion data
   getLeadConversionData: async (dateRange, filters) => {
       const userQuery = {
           createdAt: {
               $gte: new Date(dateRange.start),
               $lte: new Date(dateRange.end)
           }
       };
       
       if (filters.adminId) userQuery.adminId = filters.adminId;
       if (filters.campaignId) userQuery.campaignId = filters.campaignId;
       
       const users = await User.find(userQuery);
       const totalUsers = users.length;
       const convertedUsers = users.filter(u => u.status === 'converted').length;
       
       const metrics = [
           {
               name: 'Total Leads',
               value: totalUsers
           },
           {
               name: 'Converted Leads',
               value: convertedUsers
           },
           {
               name: 'Conversion Rate',
               value: totalUsers ? ((convertedUsers / totalUsers) * 100).toFixed(2) : 0
           }
       ];
       
       // Group by status
       const statusGroups = {};
       users.forEach(user => {
           statusGroups[user.status] = (statusGroups[user.status] || 0) + 1;
       });
       
       const data = {
           statusDistribution: Object.entries(statusGroups).map(([status, count]) => ({
               status,
               count,
               percentage: totalUsers ? ((count / totalUsers) * 100).toFixed(2) : 0
           })),
           totalUsers,
           convertedUsers
       };
       
       const dimensions = [
           {
               name: 'status',
               values: Object.keys(statusGroups)
           }
       ];
       
       return { data, metrics, dimensions };
   },
   
   // Get sales report data
   getSalesReportData: async (dateRange, filters) => {
       const orderQuery = {
           createdAt: {
               $gte: new Date(dateRange.start),
               $lte: new Date(dateRange.end)
           }
       };
       
       if (filters.adminId) orderQuery.adminId = filters.adminId;
       
       const orders = await Order.find(orderQuery);
       const payments = await Payment.find({
           paymentDate: {
               $gte: new Date(dateRange.start),
               $lte: new Date(dateRange.end)
           },
           status: 'completed'
       });
       
       const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
       const completedOrders = orders.filter(o => o.status === 'completed').length;
       const averageOrderValue = completedOrders ? totalRevenue / completedOrders : 0;
       
       const metrics = [
           {
               name: 'Total Revenue',
               value: totalRevenue
           },
           {
               name: 'Total Orders',
               value: orders.length
           },
           {
               name: 'Completed Orders',
               value: completedOrders
           },
           {
               name: 'Average Order Value',
               value: averageOrderValue.toFixed(2)
           }
       ];
       
       const data = {
           orders: orders.map(order => ({
               id: order._id,
               orderNumber: order.orderNumber,
               status: order.status,
               totalAmount: order.totalAmount
           })),
           dailyRevenue: payments.reduce((acc, payment) => {
               const date = payment.paymentDate.toISOString().split('T')[0];
               acc[date] = (acc[date] || 0) + payment.amount;
               return acc;
           }, {})
       };
       
       const dimensions = [
           {
               name: 'paymentMethods',
               values: [...new Set(payments.map(p => p.paymentMethod))]
           }
       ];
       
       return { data, metrics, dimensions };
   },
   
   // Get workflow analytics data
   getWorkflowAnalyticsData: async (dateRange, filters) => {
       const query = {
           date: {
               $gte: new Date(dateRange.start),
               $lte: new Date(dateRange.end)
           },
           entityType: 'workflow'
       };
       
       if (filters.workflowId) query.entityId = filters.workflowId;
       
       const statistics = await Statistic.find(query);
       
       const metrics = [
           {
               name: 'Total Completions',
               value: statistics.reduce((sum, stat) => 
                   stat.metricType === 'workflow_completions' ? sum + stat.value : sum, 0
               )
           },
           {
               name: 'Abandonment Rate',
               value: statistics.reduce((sum, stat) => 
                   stat.metricType === 'workflow_abandonment' ? sum + stat.value : sum, 0
               )
           },
           {
               name: 'Average Time',
               value: statistics.reduce((sum, stat) => 
                   stat.metricType === 'workflow_time' ? sum + stat.value : sum, 0
               ) / statistics.filter(s => s.metricType === 'workflow_time').length || 0
           }
       ];
       
       const data = {
           workflows: statistics.filter(s => s.entityId).map(s => ({
               id: s.entityId,
               completions: s.value
           }))
       };
       
       const dimensions = [];
       
       return { data, metrics, dimensions };
   },
   
   // Process report generation asynchronously
   processReportGeneration: async (reportId) => {
       try {
           const report = await Report.findById(reportId);
           
           if (!report) return;
           
           // Generate visualizations
           const visualizations = await ReportController.generateVisualizations(report);
           report.visualizations = visualizations;
           
           // Generate report file based on format
           let fileUrl = null;
           
           switch (report.format) {
               case 'pdf':
                   fileUrl = await ReportController.generatePDFReport(report);
                   break;
               case 'xlsx':
                   fileUrl = await ReportController.generateExcelReport(report);
                   break;
               case 'csv':
                   fileUrl = await ReportController.generateCSVReport(report);
                   break;
               default:
                   // JSON format, no file generation needed
                   break;
           }
           
           report.fileUrl = fileUrl;
           report.status = 'completed';
           await report.save();
           
           // Send notifications to recipients
           if (report.recipients && report.recipients.length > 0) {
               await ReportController.sendReportNotifications(report);
           }
           
       } catch (error) {
           console.error('Report generation failed:', error);
           
           const report = await Report.findById(reportId);
           if (report) {
               report.status = 'failed';
               report.error = {
                   message: error.message,
                   occurredAt: new Date()
               };
               await report.save();
           }
       }
   },
   
   // Generate visualizations for report
   generateVisualizations: async (report) => {
       const visualizations = [];
       
       // Basic visualizations based on report type
       switch (report.type) {
           case 'campaign_performance':
               visualizations.push({
                   type: 'line',
                   title: 'Campaign Performance Over Time',
                   data: report.data.dailyMetrics,
                   options: {
                       xAxis: 'date',
                       yAxis: 'value',
                       series: 'metricType'
                   }
               });
               break;
               
           case 'sales_report':
               visualizations.push({
                   type: 'bar',
                   title: 'Daily Revenue',
                   data: report.data.dailyRevenue,
                   options: {
                       xAxis: 'date',
                       yAxis: 'revenue'
                   }
               });
               break;
               
           default:
               // Add default visualizations
               break;
       }
       
       return visualizations;
   },
   
   // Generate PDF report
   generatePDFReport: async (report) => {
       // Implementation for PDF generation
       // This is a placeholder - you would implement actual PDF generation logic
       return `/reports/pdf/${report._id}.pdf`;
   },
   
   // Generate Excel report
   generateExcelReport: async (report) => {
       // Implementation for Excel generation
       // This is a placeholder - you would implement actual Excel generation logic
       return `/reports/excel/${report._id}.xlsx`;
   },
   
   // Generate CSV report
   generateCSVReport: async (report) => {
       // Implementation for CSV generation
       // This is a placeholder - you would implement actual CSV generation logic
       return `/reports/csv/${report._id}.csv`;
   },
   
   // Send report notifications
   sendReportNotifications: async (report) => {
       for (const recipient of report.recipients) {
           await Notification.create({
               type: 'system',
               title: 'Report Generated',
               description: `Your ${report.type} report is ready`,
               forAdmin: recipient.type === 'admin' ? recipient.userId : null,
               forSuperAdmin: recipient.type === 'superadmin' ? recipient.userId : null,
               relatedTo: {
                   model: 'Report',
                   id: report._id
               },
               actionUrl: `/reports/${report._id}`
           });
       }
   },
   
   // Download report
   downloadReport: async (req, res) => {
       try {
           const { userType, userId } = req;
           const { id } = req.params;
           
           const report = await Report.findById(id);
           
           if (!report) {
               return res.status(404).json({
                   success: false,
                   message: 'Report not found'
               });
           }
           
           // Check permission
           if (userType === 'admin' && report.adminId?.toString() !== userId) {
               // Check if user is in shared list
               const isShared = report.sharedWith.some(
                   share => share.userId.toString() === userId && share.type === 'admin'
               );
               if (!isShared) {
                   return res.status(403).json({
                       success: false,
                       message: 'Not authorized to download this report'
                   });
               }
           }
           
           if (!report.fileUrl) {
               return res.status(404).json({
                   success: false,
                   message: 'Report file not available'
               });
           }
           
           // In a real implementation, you would serve the file here
           return res.status(200).json({
               success: true,
               data: {
                   downloadUrl: report.fileUrl
               }
           });
       } catch (error) {
           console.error("Error in downloadReport:", error);
           return res.status(500).json({
               success: false,
               message: "Internal server error",
               error: error.message
           });
       }
   },
   
   // Share report
   shareReport: async (req, res) => {
       try {
           const { userType, userId } = req;
           const { id } = req.params;
           const { recipients } = req.body;
           
           const report = await Report.findById(id);
           
           if (!report) {
               return res.status(404).json({
                   success: false,
                   message: 'Report not found'
               });
           }
           
           // Check permission
           if (userType === 'admin' && report.adminId?.toString() !== userId) {
               return res.status(403).json({
                   success: false,
                   message: 'Not authorized to share this report'
               });
           }
           
           // Add recipients to shared list
           recipients.forEach(recipient => {
               const exists = report.sharedWith.some(
                   share => share.userId.toString() === recipient.userId && share.type === recipient.type
               );
               
               if (!exists) {
                   report.sharedWith.push({
                       type: recipient.type,
                       userId: recipient.userId,
                       permissions: recipient.permissions || 'view'
                   });
               }
           });
           
           await report.save();
           
           // Send notifications to new recipients
           for (const recipient of recipients) {
               await Notification.create({
                   type: 'system',
                   title: 'Report Shared',
                   description: `A ${report.type} report has been shared with you`,
                   forAdmin: recipient.type === 'admin' ? recipient.userId : null,
                   forSuperAdmin: recipient.type === 'superadmin' ? recipient.userId : null,
                   relatedTo: {
                       model: 'Report',
                       id: report._id
                   },
                   actionUrl: `/reports/${report._id}`
               });
           }
           
           return res.status(200).json({
               success: true,
               data: {
                   report
               }
           });
       } catch (error) {
           console.error("Error in shareReport:", error);
           return res.status(500).json({
               success: false,
               message: "Internal server error",
               error: error.message
           });
       }
   },
   
   // Delete report
   deleteReport: async (req, res) => {
       try {
           const { userType, userId } = req;
           const { id } = req.params;
           
           const report = await Report.findById(id);
           
           if (!report) {
               return res.status(404).json({
                   success: false,
                   message: 'Report not found'
               });
           }
           
           // Check permission
           if (userType === 'admin' && report.adminId?.toString() !== userId) {
               return res.status(403).json({
                   success: false,
                   message: 'Not authorized to delete this report'
               });
           }
           
           // Delete associated files
           if (report.fileUrl) {
               // In a real implementation, you would delete the file here
           }
           
           await report.deleteOne();
           
           // Log activity
           await ActivityLog.create({
               actorId: userId,
               actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
               action: 'report_deleted',
               entityType: 'Report',
               entityId: report._id,
               description: `Deleted report: ${report.name}`,
               status: 'success'
           });
           
           return res.status(204).json({
               success: true,
               data: null
           });
       } catch (error) {
           console.error("Error in deleteReport:", error);
           return res.status(500).json({
               success: false,
               message: "Internal server error",
               error: error.message
           });
       }
   }
};

module.exports = ReportController;