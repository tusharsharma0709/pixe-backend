// controllers/campaignControllers.js
const { Campaign } = require('../models/Campaigns');
const { Workflow } = require('../models/Workflows');
const { Admin } = require('../models/Admins');
const { User } = require('../models/Users');
const axios = require('axios');
require('dotenv').config();

/**
 * ✅ Create a new campaign (SuperAdmin function)
 */
const createCampaign = async (req, res) => {
    try {
        const { adminId, name, description, facebookCampaignDetails } = req.body;

        // Validate input
        if (!adminId || !name) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: adminId and name are required"
            });
        }

        // Check if admin exists and has verified Facebook credentials
        const admin = await Admin.findById(adminId);
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        if (!admin.facebookAccess || !admin.facebookAccess.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Admin's Facebook credentials are not verified"
            });
        }

        // Create Facebook campaign using the admin's credentials
        // This is a simplified example - in production, use proper FB API integration
        let facebookCampaignId;
        try {
            // In a real implementation, you would call Facebook API to create a campaign
            // For now, we'll mock the Facebook campaign ID
            facebookCampaignId = "fb_campaign_" + Date.now();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to create Facebook campaign",
                error: error.message
            });
        }

        // Create campaign in our database
        const campaign = new Campaign({
            name,
            description,
            adminId,
            facebookCampaignId,
            createdBy: req.superAdminId // From auth middleware
        });

        await campaign.save();

        res.status(201).json({
            success: true,
            message: "Campaign created successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error creating campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get all campaigns (SuperAdmin)
 */
const getAllCampaigns = async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate('adminId', 'first_name last_name email_id')
            .populate('workflowId', 'name');

        res.status(200).json({
            success: true,
            message: "Campaigns fetched successfully",
            data: campaigns
        });
    } catch (error) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get campaigns for a specific admin
 */
const getAdminCampaigns = async (req, res) => {
    try {
        // If adminAuth middleware was used, get adminId from req.adminId
        const adminId = req.adminId;

        if (!adminId) {
            return res.status(400).json({
                success: false,
                message: "Admin ID is required"
            });
        }

        // Verify admin exists
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        const campaigns = await Campaign.find({ adminId })
            .populate('workflowId', 'name');

        res.status(200).json({
            success: true,
            message: "Admin campaigns fetched successfully",
            data: campaigns
        });
    } catch (error) {
        console.error("Error fetching admin campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get campaign by ID
 */
const getCampaignById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const campaign = await Campaign.findById(id)
            .populate('adminId', 'first_name last_name email_id')
            .populate('workflowId', 'name');
            
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // If adminAuth middleware was used, verify this admin has access to the campaign
        if (req.adminId && campaign.adminId._id.toString() !== req.adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this campaign"
            });
        }

        res.status(200).json({
            success: true,
            message: "Campaign fetched successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error fetching campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Update campaign details
 */
const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        const campaign = await Campaign.findById(id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // If adminAuth middleware was used, verify this admin has access to the campaign
        if (req.adminId && campaign.adminId.toString() !== req.adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this campaign"
            });
        }
        
        // Update fields
        if (name) campaign.name = name;
        if (description !== undefined) campaign.description = description;
        
        await campaign.save();
        
        res.status(200).json({
            success: true,
            message: "Campaign updated successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error updating campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Update campaign status
 */
const updateCampaignStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!['active', 'paused', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value. Must be 'active', 'paused', or 'completed'"
            });
        }

        const campaign = await Campaign.findById(id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Update Facebook campaign status
        // In a real implementation, you would call Facebook API to update the campaign status
        
        // Update our database
        campaign.status = status;
        await campaign.save();

        res.status(200).json({
            success: true,
            message: "Campaign status updated successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error updating campaign status:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Delete campaign
 */
const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await Campaign.findById(id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Optionally, delete the associated Facebook campaign
        // In a real implementation, you would call Facebook API to delete the campaign

        await Campaign.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Campaign deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Assign workflow to campaign
 */
const assignWorkflowToCampaign = async (req, res) => {
    try {
        const { campaignId, workflowId } = req.body;

        // Check if campaign exists
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Check if workflow exists
        const workflow = await Workflow.findById(workflowId);
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }

        // Check if workflow belongs to the same admin as campaign
        if (workflow.adminId.toString() !== campaign.adminId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Workflow does not belong to the campaign's admin"
            });
        }

        // Update campaign with workflow
        campaign.workflowId = workflowId;
        await campaign.save();

        res.status(200).json({
            success: true,
            message: "Workflow assigned to campaign successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error assigning workflow to campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get campaign users
 */
const getCampaignUsers = async (req, res) => {
    try {
        const { id } = req.params;
        
        const campaign = await Campaign.findById(id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // If adminAuth middleware was used, verify this admin has access to the campaign
        if (req.adminId && campaign.adminId.toString() !== req.adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this campaign's users"
            });
        }
        
        // Get users for this campaign
        const users = await User.find({ campaignId: id });
        
        res.status(200).json({
            success: true,
            message: "Campaign users fetched successfully",
            data: users
        });
    } catch (error) {
        console.error("Error fetching campaign users:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get campaign statistics
 */
const getCampaignStats = async (req, res) => {
    try {
        const { id } = req.params;
        
        const campaign = await Campaign.findById(id);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // If adminAuth middleware was used, verify this admin has access to the campaign
        if (req.adminId && campaign.adminId.toString() !== req.adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this campaign's statistics"
            });
        }
        
        // Get stats for this campaign
        const userCount = await User.countDocuments({ campaignId: id });
        
        // Additional stats as needed
        // Example: Count users at different stages of verification
        const verifiedUsersCount = await User.countDocuments({ 
            campaignId: id,
            isPanVerified: true,
            isAadhaarVerified: true 
        });
        
        res.status(200).json({
            success: true,
            message: "Campaign statistics fetched successfully",
            data: {
                totalUsers: userCount,
                verifiedUsers: verifiedUsersCount,
                conversionRate: userCount > 0 ? (verifiedUsersCount / userCount * 100).toFixed(2) + '%' : '0%'
            }
        });
    } catch (error) {
        console.error("Error fetching campaign statistics:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    createCampaign,
    getAllCampaigns,
    getAdminCampaigns,
    getCampaignById,
    updateCampaign,
    updateCampaignStatus,
    deleteCampaign,
    assignWorkflowToCampaign,
    getCampaignUsers,
    getCampaignStats
};