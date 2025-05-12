// controllers/campaignWorkflowController.js
const { CampaignRequest } = require('../models/CampaignRequests');
const { Campaign } = require('../models/Campaigns');
const { Admin } = require('../models/Admins');
const { SuperAdmin } = require('../models/SuperAdmins');
const { Workflow } = require('../models/Workflows');
const { Notification } = require('../models/Notifications');
const { ActivityLog } = require('../models/ActivityLogs');
const { FileUpload } = require('../models/FileUploads');
const upload = require('../middlewares/multer');

/**
 * Admin Functions
 */

/**
 * Create a new campaign request
 */
const createCampaignRequest = async (req, res) => {
    try {
        const adminId = req.adminId;
        
        // Validate the admin exists and is active
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }
        
        if (!admin.status) {
            return res.status(403).json({
                success: false,
                message: "Your account is not active. Please contact the Super Admin."
            });
        }
        
        // Check if admin has verified Facebook credentials
        if (!admin.facebookAccess || !admin.facebookAccess.isVerified) {
            return res.status(400).json({
                success: false,
                message: "You need to verify your Facebook credentials before creating campaigns"
            });
        }
        
        // Extract data from request
        const { 
            name, 
            description, 
            objective, 
            adType, 
            platform,
            targeting, 
            budgetSchedule, 
            creatives, 
            workflowId,
            pixelId,
            catalogId,
            adminNotes
        } = req.body;
        
        // Validate required fields
        if (!name || !objective || !adType || !budgetSchedule || !creatives) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }
        
        // Validate workflow if provided
        if (workflowId) {
            const workflow = await Workflow.findById(workflowId);
            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }
            
            // Check if the workflow belongs to the admin
            if (workflow.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to use this workflow"
                });
            }
        }
        
        // Process uploaded files if any
        let creativeFiles = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const fileUpload = new FileUpload({
                    filename: file.filename || `campaign_creative_${Date.now()}`,
                    originalFilename: file.originalname,
                    path: file.path || file.location,
                    url: file.location || file.path,
                    mimeType: file.mimetype,
                    size: file.size,
                    uploadedBy: {
                        id: adminId,
                        role: 'admin'
                    },
                    adminId,
                    entityType: 'campaign_request',
                    isPublic: true
                });
                
                await fileUpload.save();
                creativeFiles.push(fileUpload);
            }
        }
        
        // Create campaign request
        const campaignRequest = new CampaignRequest({
            adminId,
            name,
            description,
            objective,
            platform: platform || 'facebook',
            adType,
            targeting: targeting || {},
            budgetSchedule,
            creatives: creatives.map((creative, index) => ({
                ...creative,
                imageUrls: creativeFiles.length > index ? [creativeFiles[index].url] : creative.imageUrls || [],
                videoUrls: creative.videoUrls || []
            })),
            workflowId,
            pixelId,
            catalogId,
            status: 'submitted',
            adminNotes
        });
        
        await campaignRequest.save();
        
        // Log activity
        await ActivityLog.create({
            actorId: adminId,
            actorModel: 'Admins',
            actorName: `${admin.first_name} ${admin.last_name}`,
            action: 'campaign_requested',
            entityType: 'CampaignRequest',
            entityId: campaignRequest._id,
            description: `Campaign request "${name}" was submitted by admin`,
            status: 'success'
        });
        
        // Create notification for Super Admins
        await Notification.create({
            title: 'New Campaign Request',
            description: `${admin.first_name} ${admin.last_name} has submitted a new campaign request: ${name}`,
            type: 'campaign_request',
            forSuperAdmin: true,
            relatedTo: {
                model: 'CampaignRequest',
                id: campaignRequest._id
            },
            priority: 'medium'
        });
        
        res.status(201).json({
            success: true,
            message: "Campaign request submitted successfully",
            data: {
                _id: campaignRequest._id,
                name: campaignRequest.name,
                status: campaignRequest.status,
                createdAt: campaignRequest.createdAt
            }
        });
    } catch (error) {
        console.error("Error creating campaign request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get all campaign requests for an admin
 */
const getAdminCampaignRequests = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { status, limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
        
        // Build query
        const query = { adminId };
        
        // Add status filter if provided
        if (status) {
            query.status = status;
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'desc' ? -1 : 1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;
        
        // Get campaign requests with pagination
        const campaignRequests = await CampaignRequest.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('workflowId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedCampaignId', 'name status');
        
        // Get total count for pagination
        const totalCount = await CampaignRequest.countDocuments(query);
        
        res.status(200).json({
            success: true,
            message: "Campaign requests fetched successfully",
            data: {
                campaignRequests,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error getting campaign requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get admin's active campaigns
 */
const getAdminCampaigns = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { status, limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
        
        // Build query
        const query = { adminId };
        
        // Add status filter if provided
        if (status) {
            query.status = status;
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'desc' ? -1 : 1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;
        
        // Get campaigns with pagination
        const campaigns = await Campaign.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('workflowId', 'name')
            .populate('createdBy', 'first_name last_name')
            .populate('originalRequestId', 'name');
        
        // Get total count for pagination
        const totalCount = await Campaign.countDocuments(query);
        
        res.status(200).json({
            success: true,
            message: "Campaigns fetched successfully",
            data: {
                campaigns,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error getting campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Super Admin Functions
 */

/**
 * Get all campaign requests (Super Admin)
 */
const getAllCampaignRequests = async (req, res) => {
    try {
        const { status, adminId, limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
        
        // Build query
        const query = {};
        
        // Add status filter if provided
        if (status) {
            query.status = status;
        }
        
        // Add admin filter if provided
        if (adminId) {
            query.adminId = adminId;
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'desc' ? -1 : 1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;
        
        // Get campaign requests with pagination
        const campaignRequests = await CampaignRequest.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('adminId', 'first_name last_name email_id')
            .populate('workflowId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedCampaignId', 'name status');
        
        // Get total count for pagination
        const totalCount = await CampaignRequest.countDocuments(query);
        
        res.status(200).json({
            success: true,
            message: "Campaign requests fetched successfully",
            data: {
                campaignRequests,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error getting campaign requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Review campaign request (Super Admin)
 */
const reviewCampaignRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdminId = req.superAdminId;
        const { status, superAdminNotes } = req.body;
        
        // Validate status
        if (!['approved', 'rejected', 'under_review'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'approved', 'rejected', or 'under_review'"
            });
        }
        
        // Find campaign request
        const campaignRequest = await CampaignRequest.findById(id);
        
        if (!campaignRequest) {
            return res.status(404).json({
                success: false,
                message: "Campaign request not found"
            });
        }
        
        // Check if campaign request is in a state that can be reviewed
        if (!['submitted', 'under_review'].includes(campaignRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Campaign request cannot be reviewed in "${campaignRequest.status}" status`
            });
        }
        
        // Require notes for rejection
        if (status === 'rejected' && !superAdminNotes) {
            return res.status(400).json({
                success: false,
                message: "Notes are required when rejecting a campaign request"
            });
        }
        
        // Update campaign request
        campaignRequest.status = status;
        campaignRequest.superAdminId = superAdminId;
        campaignRequest.reviewedAt = new Date();
        
        if (superAdminNotes !== undefined) {
            campaignRequest.superAdminNotes = superAdminNotes;
        }
        
        await campaignRequest.save();
        
        // Get admin details for notification
        const admin = await Admin.findById(campaignRequest.adminId);
        
        // Create notification for admin
        await Notification.create({
            title: `Campaign Request ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Under Review'}`,
            description: `Your campaign request "${campaignRequest.name}" has been ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'placed under review'}`,
            type: 'campaign_request',
            forAdmin: campaignRequest.adminId,
            relatedTo: {
                model: 'CampaignRequest',
                id: campaignRequest._id
            },
            priority: 'high'
        });
        
        // Log activity
        await ActivityLog.create({
            actorId: superAdminId,
            actorModel: 'SuperAdmins',
            action: `campaign_request_${status}`,
            entityType: 'CampaignRequest',
            entityId: campaignRequest._id,
            description: `Campaign request "${campaignRequest.name}" was ${status} by super admin`,
            status: 'success'
        });
        
        res.status(200).json({
            success: true,
            message: `Campaign request ${status} successfully`,
            data: {
                _id: campaignRequest._id,
                name: campaignRequest.name,
                status: campaignRequest.status
            }
        });
    } catch (error) {
        console.error("Error reviewing campaign request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Publish campaign (Super Admin)
 */
const publishCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdminId = req.superAdminId;
        const { 
            facebookCampaignId, 
            facebookCampaignUrl, 
            campaignDetails 
        } = req.body;
        
        // Validate required fields
        if (!facebookCampaignId) {
            return res.status(400).json({
                success: false,
                message: "Facebook campaign ID is required"
            });
        }
        
        // Find campaign request
        const campaignRequest = await CampaignRequest.findById(id);
        
        if (!campaignRequest) {
            return res.status(404).json({
                success: false,
                message: "Campaign request not found"
            });
        }
        
        // Check if campaign request is approved
        if (campaignRequest.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Only approved campaign requests can be published"
            });
        }
        
        // Create campaign
        const campaign = new Campaign({
            name: campaignRequest.name,
            description: campaignRequest.description,
            adminId: campaignRequest.adminId,
            facebookCampaignId,
            facebookCampaignUrl: facebookCampaignUrl || null,
            campaignDetails: campaignDetails || {},
            status: 'active',
            workflowId: campaignRequest.workflowId,
            createdBy: superAdminId,
            originalRequestId: campaignRequest._id,
            budget: {
                daily: campaignRequest.budgetSchedule.dailyBudget,
                total: campaignRequest.budgetSchedule.totalBudget,
                currency: 'INR'
            },
            startDate: campaignRequest.budgetSchedule.startDate,
            endDate: campaignRequest.budgetSchedule.endDate,
            activatedAt: new Date()
        });
        
        await campaign.save();
        
        // Update campaign request
        campaignRequest.status = 'published';
        campaignRequest.publishedAt = new Date();
        campaignRequest.publishedCampaignId = campaign._id;
        
        await campaignRequest.save();
        
        // Get admin details for notification
        const admin = await Admin.findById(campaignRequest.adminId);
        
        // Create notification for admin
        await Notification.create({
            title: 'Campaign Published',
            description: `Your campaign "${campaignRequest.name}" has been published and is now active`,
            type: 'campaign_published',
            forAdmin: campaignRequest.adminId,
            relatedTo: {
                model: 'Campaign',
                id: campaign._id
            },
            priority: 'high'
        });
        
        // Log activity
        await ActivityLog.create({
            actorId: superAdminId,
            actorModel: 'SuperAdmins',
            action: 'campaign_published',
            entityType: 'Campaign',
            entityId: campaign._id,
            description: `Campaign "${campaign.name}" was published by super admin`,
            status: 'success'
        });
        
        res.status(200).json({
            success: true,
            message: "Campaign published successfully",
            data: {
                campaignRequest: {
                    _id: campaignRequest._id,
                    name: campaignRequest.name,
                    status: campaignRequest.status
                },
                campaign: {
                    _id: campaign._id,
                    name: campaign.name,
                    facebookCampaignId: campaign.facebookCampaignId,
                    status: campaign.status
                }
            }
        });
    } catch (error) {
        console.error("Error publishing campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    // Admin endpoints
    createCampaignRequest,
    getAdminCampaignRequests,
    getAdminCampaigns,
    
    // Super Admin endpoints
    getAllCampaignRequests,
    reviewCampaignRequest,
    publishCampaign
};