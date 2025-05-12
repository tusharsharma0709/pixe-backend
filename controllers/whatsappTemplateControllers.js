// controllers/WhatsAppTemplateController.js
const { WhatsappTemplate } = require('../models/WhatsappTemplates');
const { Admin } = require('../models/Admins');
const { SuperAdmin } = require('../models/SuperAdmins');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const axios = require('axios');
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

// Helper function to create notification
const createNotification = async (data) => {
    try {
        const notification = new Notification(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};

const WhatsAppTemplateController = {
    // Create a new WhatsApp template
    createTemplate: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                name,
                category,
                language,
                components,
                example,
                variables
            } = req.body;

            // Validate required fields
            if (!name || !category || !components || components.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Name, category, and components are required"
                });
            }

            // Check if template name already exists for this admin
            const existingTemplate = await WhatsappTemplate.findOne({
                adminId,
                name
            });

            if (existingTemplate) {
                return res.status(400).json({
                    success: false,
                    message: "A template with this name already exists"
                });
            }

            // Validate components
            for (const component of components) {
                if (!component.type) {
                    return res.status(400).json({
                        success: false,
                        message: "Each component must have a type"
                    });
                }

                // Validate based on component type
                switch (component.type) {
                    case 'header':
                    case 'body':
                    case 'footer':
                        if (!component.text) {
                            return res.status(400).json({
                                success: false,
                                message: `${component.type} component must have text`
                            });
                        }
                        break;
                    case 'button':
                        if (!component.buttons || component.buttons.length === 0) {
                            return res.status(400).json({
                                success: false,
                                message: "Button component must have buttons"
                            });
                        }
                        break;
                }
            }

            // Create template
            const template = new WhatsappTemplate({
                name,
                adminId,
                category,
                language: language || 'en_US',
                components,
                example,
                variables: variables || [],
                status: 'draft'
            });

            await template.save();

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'custom',
                entityType: 'WhatsappTemplate',
                entityId: template._id,
                description: `Created WhatsApp template: ${template.name}`,
                adminId
            });

            return res.status(201).json({
                success: true,
                message: "WhatsApp template created successfully",
                data: template
            });
        } catch (error) {
            console.error("Error in createTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all templates for admin
    getAdminTemplates: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                category,
                isActive,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (category) query.category = category;
            if (typeof isActive === 'boolean') query.isActive = isActive;

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { example: { $regex: search, $options: 'i' } }
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
            const totalCount = await WhatsappTemplate.countDocuments(query);

            // Execute query with pagination
            const templates = await WhatsappTemplate.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: templates,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminTemplates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all templates for super admin
    getSuperAdminTemplates: async (req, res) => {
        try {
            const {
                adminId,
                status,
                category,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = {};

            if (adminId) query.adminId = adminId;
            if (status) query.status = status;
            if (category) query.category = category;

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { example: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1;
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await WhatsappTemplate.countDocuments(query);

            // Execute query with pagination
            const templates = await WhatsappTemplate.find(query)
                .populate('adminId', 'first_name last_name business_name')
                .populate('reviewedBy', 'first_name last_name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: templates,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getSuperAdminTemplates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get template by ID
    getTemplate: async (req, res) => {
        try {
            const { id } = req.params;

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Check permissions
            if (req.adminId && template.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this template"
                });
            }

            return res.status(200).json({
                success: true,
                data: template
            });
        } catch (error) {
            console.error("Error in getTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update template
    updateTemplate: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const {
                name,
                category,
                language,
                components,
                example,
                variables,
                isActive
            } = req.body;

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Check permissions
            if (template.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this template"
                });
            }

            // Can only update draft or rejected templates
            if (!['draft', 'rejected'].includes(template.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Can only update draft or rejected templates"
                });
            }

            // Update fields
            if (name) template.name = name;
            if (category) template.category = category;
            if (language) template.language = language;
            if (components) template.components = components;
            if (example) template.example = example;
            if (variables) template.variables = variables;
            if (typeof isActive === 'boolean') template.isActive = isActive;

            await template.save();

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'custom',
                entityType: 'WhatsappTemplate',
                entityId: template._id,
                description: `Updated WhatsApp template: ${template.name}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "Template updated successfully",
                data: template
            });
        } catch (error) {
            console.error("Error in updateTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Submit template for review
    submitForReview: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Check permissions
            if (template.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to submit this template"
                });
            }

            // Can only submit draft templates
            if (template.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    message: "Can only submit draft templates for review"
                });
            }

            // Update template status
            template.status = 'submitted';
            template.approvalInfo = {
                ...template.approvalInfo,
                submittedAt: new Date()
            };

            await template.save();

            // Create notification for super admin
            await createNotification({
                title: "New WhatsApp Template for Review",
                description: `Template "${template.name}" submitted for review by ${template.adminId}`,
                type: 'system',
                priority: 'medium',
                forSuperAdmin: true,
                relatedTo: {
                    model: 'WhatsappTemplate',
                    id: template._id
                }
            });

            return res.status(200).json({
                success: true,
                message: "Template submitted for review",
                data: template
            });
        } catch (error) {
            console.error("Error in submitForReview:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Review template (Super Admin)
    reviewTemplate: async (req, res) => {
        try {
            const { id } = req.params;
            const superAdminId = req.superAdminId;
            const { status, rejectionReason, facebookTemplateId } = req.body;

            // Validate status
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status. Must be 'approved' or 'rejected'"
                });
            }

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Can only review submitted templates
            if (template.status !== 'submitted') {
                return res.status(400).json({
                    success: false,
                    message: "Can only review submitted templates"
                });
            }

            // Require rejection reason if rejecting
            if (status === 'rejected' && !rejectionReason) {
                return res.status(400).json({
                    success: false,
                    message: "Rejection reason is required"
                });
            }

            // Require Facebook template ID if approving
            if (status === 'approved' && !facebookTemplateId) {
                return res.status(400).json({
                    success: false,
                    message: "Facebook template ID is required for approval"
                });
            }

            // Update template
            template.status = status;
            template.reviewedBy = superAdminId;
            template.reviewedAt = new Date();

            if (status === 'approved') {
                template.facebookTemplateId = facebookTemplateId;
                template.approvalInfo = {
                    ...template.approvalInfo,
                    approvedAt: new Date()
                };
            } else {
                template.rejectionReason = rejectionReason;
                template.approvalInfo = {
                    ...template.approvalInfo,
                    rejectedAt: new Date()
                };
            }

            await template.save();

            // Get super admin details for logging
            const superAdmin = await SuperAdmin.findById(superAdminId);

            // Log activity
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'custom',
                entityType: 'WhatsappTemplate',
                entityId: template._id,
                description: `${status} WhatsApp template: ${template.name}`,
                adminId: template.adminId
            });

            // Create notification for admin
            await createNotification({
                title: `WhatsApp Template ${status === 'approved' ? 'Approved' : 'Rejected'}`,
                description: `Your template "${template.name}" has been ${status}`,
                type: status === 'approved' ? 'product_approval' : 'product_rejection',
                priority: 'high',
                forAdmin: template.adminId,
                relatedTo: {
                    model: 'WhatsappTemplate',
                    id: template._id
                }
            });

            return res.status(200).json({
                success: true,
                message: `Template ${status} successfully`,
                data: template
            });
        } catch (error) {
            console.error("Error in reviewTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete template
    deleteTemplate: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Check permissions
            if (template.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to delete this template"
                });
            }

            // Can only delete draft or rejected templates
            if (!['draft', 'rejected'].includes(template.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Can only delete draft or rejected templates"
                });
            }

            await WhatsappTemplate.findByIdAndDelete(id);

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'custom',
                entityType: 'WhatsappTemplate',
                entityId: id,
                description: `Deleted WhatsApp template: ${template.name}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "Template deleted successfully"
            });
        } catch (error) {
            console.error("Error in deleteTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get template usage statistics
    getTemplateUsageStats: async (req, res) => {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;

            const template = await WhatsappTemplate.findById(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: "Template not found"
                });
            }

            // Check permissions
            if (req.adminId && template.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view template statistics"
                });
            }

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Get message statistics
            const Message = require('../models/Messages').Message;
            const messageCount = await Message.countDocuments({
                messageType: 'template',
                'metadata.templateId': template._id,
                ...dateFilter
            });

            // Get daily usage
            const dailyUsage = await Message.aggregate([
                {
                    $match: {
                        messageType: 'template',
                        'metadata.templateId': template._id,
                        ...dateFilter
                    }
                },
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

            // Format daily usage
            const formattedDailyUsage = dailyUsage.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                count: item.count
            }));

            // Update template usage count
            template.usageCount = messageCount;
            template.lastUsedAt = new Date();
            await template.save();

            return res.status(200).json({
                success: true,
                data: {
                    template: {
                        id: template._id,
                        name: template.name,
                        category: template.category
                    },
                    totalUsage: messageCount,
                    dailyUsage: formattedDailyUsage
                }
            });
        } catch (error) {
            console.error("Error in getTemplateUsageStats:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = WhatsAppTemplateController;