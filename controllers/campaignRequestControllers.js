// controllers/campaignRequestControllers.js
const { CampaignRequest } = require('../models/CampaignRequests');
const { Campaign } = require('../models/Campaigns');
const { Admin } = require('../models/Admins');
const { SuperAdmin } = require('../models/SuperAdmins');
const { Workflow } = require('../models/Workflows');
const { Notification } = require('../models/Notifications');
const { ActivityLog } = require('../models/ActivityLogs');
const { FileUpload } = require('../models/FileUploads');
const { getBucket } = require('../services/firebase');
const { saveFileLocally } = require('../services/localfiles');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Admin Functions
 */

/**
 * Create a new campaign request
 * @route POST /api/v1/campaigns/requests
 * @access Private (Admin)
 */
const createCampaignRequest = async (req, res) => {
    console.log('Creating new campaign request...');
    
    try {
        const adminId = req.adminId;
        
        // Debug info for uploaded files
        if (req.files && req.files.length > 0) {
            console.log(`Received ${req.files.length} files with request`);
            req.files.forEach((file, index) => {
                console.log(`File ${index + 1}:`, {
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    buffer: file.buffer ? 'Buffer present' : 'No buffer'
                });
            });
        } else {
            console.log('No files received with request');
        }
        
        // Validate the admin exists and is active
        const admin = await Admin.findById(adminId);
        if (!admin) {
            console.log(`Admin not found with ID: ${adminId}`);
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }
        
        if (!admin.status) {
            console.log(`Admin account is not active: ${adminId}`);
            return res.status(403).json({
                success: false,
                message: "Your account is not active. Please contact the Super Admin."
            });
        }
        
        // Check if admin has verified Facebook credentials
        if (!admin.fb_credentials_verified) {
            console.log(`Admin has unverified Facebook credentials: ${adminId}`);
            return res.status(400).json({
                success: false,
                message: "You need to verify your Facebook credentials before creating campaigns"
            });
        }
        
        // Extract data from request
        console.log('Extracting request data...');
        let { 
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
        
        console.log('Request body:', {
            name, 
            description, 
            objective, 
            adType, 
            platform,
            targeting: typeof targeting, 
            budgetSchedule: typeof budgetSchedule, 
            creatives: typeof creatives, 
            workflowId,
            pixelId,
            catalogId,
            adminNotes
        });
        
        // Parse JSON strings if coming from form-data
        try {
            if (typeof targeting === 'string') {
                console.log('Parsing targeting JSON...');
                targeting = JSON.parse(targeting);
            }
            if (typeof budgetSchedule === 'string') {
                console.log('Parsing budgetSchedule JSON...');
                budgetSchedule = JSON.parse(budgetSchedule);
            }
            if (typeof creatives === 'string') {
                console.log('Parsing creatives JSON...');
                creatives = JSON.parse(creatives);
            }
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            return res.status(400).json({
                success: false,
                message: "Invalid JSON format in request data",
                error: parseError.message
            });
        }
        
        // Validate required fields
        if (!name || !objective || !adType || !budgetSchedule || !creatives) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }
        
        // Validate that creatives is an array
        if (!Array.isArray(creatives)) {
            console.log('Creatives is not an array');
            return res.status(400).json({
                success: false,
                message: "Creatives must be an array"
            });
        }
        
        // Format targeting data correctly if needed
        if (targeting && typeof targeting === 'object') {
            // Convert age_min and age_max if present
            if (targeting.age_min || targeting.age_max) {
                targeting.ageRange = {
                    min: parseInt(targeting.age_min) || 18,
                    max: parseInt(targeting.age_max) || 65
                };
                
                // Remove original fields to maintain schema
                delete targeting.age_min;
                delete targeting.age_max;
            }
            
            // Handle gender
            if (targeting.genders) {
                // Convert [1, 2] format to "all"/"male"/"female"
                if (Array.isArray(targeting.genders)) {
                    if (targeting.genders.includes(1) && targeting.genders.includes(2)) {
                        targeting.gender = "all";
                    } else if (targeting.genders.includes(1)) {
                        targeting.gender = "male";
                    } else if (targeting.genders.includes(2)) {
                        targeting.gender = "female";
                    } else {
                        targeting.gender = "all"; // Default
                    }
                    
                    // Remove original field
                    delete targeting.genders;
                }
            } else {
                targeting.gender = "all"; // Default
            }
            
            // Ensure arrays are properly initialized
            targeting.locations = targeting.locations || [];
            targeting.interests = targeting.interests || [];
            targeting.languages = targeting.languages || [];
            targeting.excludedAudiences = targeting.excludedAudiences || [];
            targeting.customAudiences = targeting.customAudiences || [];
        } else {
            // Create default targeting object
            targeting = {
                ageRange: { min: 18, max: 65 },
                gender: "all",
                locations: [],
                interests: [],
                languages: [],
                excludedAudiences: [],
                customAudiences: []
            };
        }
        
        // Format budget schedule data
        if (budgetSchedule && typeof budgetSchedule === 'object') {
            // Convert string dates to Date objects
            if (typeof budgetSchedule.startDate === 'string') {
                budgetSchedule.startDate = new Date(budgetSchedule.startDate);
            }
            if (typeof budgetSchedule.endDate === 'string') {
                budgetSchedule.endDate = new Date(budgetSchedule.endDate);
            }
            
            // Ensure numeric values for budgets
            budgetSchedule.dailyBudget = parseFloat(budgetSchedule.dailyBudget) || 0;
            budgetSchedule.totalBudget = parseFloat(budgetSchedule.totalBudget) || 0;
        }
        
        // Format creatives data
        creatives = creatives.map(creative => {
            // Rename fields to match the schema if needed
            return {
                headline: creative.headline,
                description: creative.description,
                callToAction: creative.cta || creative.callToAction || "Learn More",
                primaryText: creative.primaryText || "",
                imageUrls: creative.imageUrls || [],
                videoUrls: creative.videoUrls || []
            };
        });
        
        // Validate workflow if provided
        if (workflowId) {
            console.log(`Validating workflow: ${workflowId}`);
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
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            try {
                console.log('Processing uploaded files...');
                // Get Firebase Storage bucket
                const bucket = getBucket();
                console.log(`Using Firebase bucket: ${bucket.name}`);
                
                for (const file of req.files) {
                    try {
                        console.log(`Processing file: ${file.originalname}`);
                        
                        // Generate unique filename
                        const fileExt = path.extname(file.originalname);
                        const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
                        
                        // Create folder structure by date: yyyy/mm/
                        const currentDate = new Date();
                        const year = currentDate.getFullYear();
                        const month = currentDate.getMonth() + 1;
                        
                        const filePath = `uploads/campaigns/${year}/${month}/${filename}`;
                        console.log(`File path in storage: ${filePath}`);
                        
                        // Create a file reference in Firebase Storage
                        const fileRef = bucket.file(filePath);
                        
                        // Upload file to Firebase Storage
                        console.log('Uploading file to Firebase...');
                        await fileRef.save(file.buffer, {
                            metadata: {
                                contentType: file.mimetype,
                                originalName: file.originalname
                            },
                            public: true,
                            resumable: false
                        });
                        
                        // Get public URL
                        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                        console.log(`File uploaded successfully. URL: ${fileUrl}`);
                        
                        // Create file upload record
                        const fileUpload = await FileUpload.create({
                            filename,
                            originalFilename: file.originalname,
                            path: filePath,
                            url: fileUrl,
                            mimeType: file.mimetype,
                            size: file.size,
                            uploadedBy: {
                                id: adminId,
                                role: 'admin'
                            },
                            adminId,
                            entityType: 'campaign_request',
                            status: 'permanent',
                            isPublic: true,
                            bucket: bucket.name,
                            storageProvider: 'google_cloud',
                            storageMetadata: {
                                firebasePath: filePath
                            }
                        });
                        
                        console.log(`File record created with ID: ${fileUpload._id}`);
                        creativeFiles.push(fileUpload);
                    } catch (fileError) {
                        console.error("Error uploading file to Firebase:", fileError);
                        
                        // Try uploading to local storage as a fallback
                        try {
                            console.log('Attempting local file storage as fallback...');
                            const fileUpload = await saveFileLocally(file, adminId, 'admin', 'campaign_request');
                            creativeFiles.push(fileUpload);
                            console.log(`File saved locally. URL: ${fileUpload.url}`);
                        } catch (localError) {
                            console.error("Error with local file fallback:", localError);
                        }
                    }
                }
            } catch (storageError) {
                console.error("Error with Firebase storage:", storageError);
                
                // Fallback to local storage if Firebase fails
                try {
                    console.log('Firebase storage failed. Falling back to local storage...');
                    for (const file of req.files) {
                        const fileUpload = await saveFileLocally(file, adminId, 'admin', 'campaign_request');
                        creativeFiles.push(fileUpload);
                        console.log(`File saved locally. URL: ${fileUpload.url}`);
                    }
                } catch (fallbackError) {
                    console.error("Error with local fallback storage:", fallbackError);
                    // Continue without files if both methods fail
                }
            }
        } else {
            console.log('No files to process');
        }
        
        // Create campaign request
        console.log('Creating campaign request in database...');
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
        console.log(`Campaign request saved with ID: ${campaignRequest._id}`);
        
        // Update file uploads with the campaign request ID
        if (creativeFiles.length > 0) {
            console.log('Updating file records with campaign request ID...');
            await FileUpload.updateMany(
                { _id: { $in: creativeFiles.map(file => file._id) } },
                { $set: { entityId: campaignRequest._id } }
            );
        }
        
        // Log activity
        console.log('Creating activity log entry...');
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
        console.log('Creating notification for Super Admins...');
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
        
        console.log('Campaign request process completed successfully');
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
            adminId: campaignRequest.adminId,
            relatedTo: {
                model: 'CampaignRequest',
                id: campaignRequest._id
            },
            priority: 'high'
        });
        
        // Map status to existing action enum values
        let action;
        if (status === 'approved') {
            action = 'campaign_approved';
        } else if (status === 'rejected') {
            action = 'campaign_rejected';
        } else {
            action = 'campaign_reviewed'; // Use existing 'campaign_reviewed' for under_review status
        }
        
        // Log activity
        await ActivityLog.create({
            actorId: superAdminId,
            actorModel: 'SuperAdmins',
            action: action,
            entityType: 'CampaignRequest',
            entityId: campaignRequest._id,
            description: `Campaign request "${campaignRequest.name}" was ${status === 'under_review' ? 'placed under review' : status} by super admin`,
            status: 'success',
            adminId: campaignRequest.adminId
        });
        
        res.status(200).json({
            success: true,
            message: `Campaign request ${status === 'under_review' ? 'placed under review' : status} successfully`,
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
        
        // Update any file uploads to link to the published campaign
        await FileUpload.updateMany(
            { entityType: 'campaign_request', entityId: campaignRequest._id },
            { $set: { entityType: 'campaign', entityId: campaign._id } }
        );
        
        // Get admin details for notification
        const admin = await Admin.findById(campaignRequest.adminId);
        
        // Create notification for admin
        await Notification.create({
            title: 'Campaign Published',
            description: `Your campaign "${campaignRequest.name}" has been published and is now active`,
            type: 'campaign_published',
            adminId: campaignRequest.adminId,
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

// Add these methods to controllers/campaignRequestControllers.js

/**
 * Get campaign request by ID (Admin)
 */
const getCampaignRequestById = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { id } = req.params;
        
        // Find campaign request
        const campaignRequest = await CampaignRequest.findById(id)
            .populate('workflowId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedCampaignId', 'name status');
        
        if (!campaignRequest) {
            return res.status(404).json({
                success: false,
                message: "Campaign request not found"
            });
        }
        
        // Check if campaign request belongs to the admin
        if (campaignRequest.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to view this campaign request"
            });
        }
        
        // Get associated files
        const files = await FileUpload.find({
            entityType: 'campaign_request',
            entityId: campaignRequest._id,
            status: { $ne: 'deleted' }
        });
        
        res.status(200).json({
            success: true,
            message: "Campaign request fetched successfully",
            data: {
                campaignRequest,
                files
            }
        });
    } catch (error) {
        console.error("Error getting campaign request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get campaign request details (Super Admin)
 */
const getCampaignRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find campaign request
        const campaignRequest = await CampaignRequest.findById(id)
            .populate('adminId', 'first_name last_name email_id')
            .populate('workflowId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedCampaignId', 'name status');
        
        if (!campaignRequest) {
            return res.status(404).json({
                success: false,
                message: "Campaign request not found"
            });
        }
        
        // Get admin details
        const admin = await Admin.findById(campaignRequest.adminId).select('fb_credentials_verified');
        
        // Get associated files
        const files = await FileUpload.find({
            entityType: 'campaign_request',
            entityId: campaignRequest._id,
            status: { $ne: 'deleted' }
        });
        
        res.status(200).json({
            success: true,
            message: "Campaign request details fetched successfully",
            data: {
                campaignRequest,
                files,
                adminDetails: {
                    fb_credentials_verified: admin.fb_credentials_verified
                }
            }
        });
    } catch (error) {
        console.error("Error getting campaign request details:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Don't forget to add these to the exports
module.exports = {
    // Admin endpoints
    createCampaignRequest,
    getAdminCampaignRequests,
    getCampaignRequestById,
    getAdminCampaigns,
    
    // Super Admin endpoints
    getAllCampaignRequests,
    getCampaignRequestDetails,
    reviewCampaignRequest,
    publishCampaign
};