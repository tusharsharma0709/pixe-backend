// controllers/workflowControllers.js
const { Workflow } = require('../models/Workflows');
const { Campaign } = require('../models/Campaigns');
const { Admin } = require('../models/Admins');
const { UserSession } = require('../models/UserSessions');

/**
 * ✅ Create a new workflow
 */
const createWorkflow = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { name, description, nodes } = req.body;
        
        // Validate input
        if (!name || !nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Name and at least one node are required"
            });
        }
        
        // Ensure admin is active
        const admin = await Admin.findById(adminId);
        if (!admin || !admin.status) {
            return res.status(403).json({
                success: false,
                message: "Admin account is not active. Please verify your Facebook credentials first."
            });
        }
        
        // Create workflow
        const workflow = new Workflow({
            name,
            description,
            adminId,
            nodes
        });
        
        await workflow.save();
        
        res.status(201).json({
            success: true,
            message: "Workflow created successfully",
            data: workflow
        });
    } catch (error) {
        console.error("Error creating workflow:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get all workflows for an admin
 */
const getAllWorkflows = async (req, res) => {
    try {
        const adminId = req.adminId;
        
        const workflows = await Workflow.find({ adminId });
        
        res.status(200).json({
            success: true,
            message: "Workflows fetched successfully",
            data: workflows
        });
    } catch (error) {
        console.error("Error fetching workflows:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get workflow by ID
 */
const getWorkflowById = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        const workflow = await Workflow.findById(id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this workflow"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Workflow fetched successfully",
            data: workflow
        });
    } catch (error) {
        console.error("Error fetching workflow:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Update workflow
 */
const updateWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        const { name, description, nodes, isActive } = req.body;
        
        // Find workflow
        const workflow = await Workflow.findById(id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this workflow"
            });
        }
        
        // Update workflow fields
        if (name) workflow.name = name;
        if (description !== undefined) workflow.description = description;
        if (nodes && Array.isArray(nodes) && nodes.length > 0) workflow.nodes = nodes;
        if (isActive !== undefined) workflow.isActive = isActive;
        
        await workflow.save();
        
        res.status(200).json({
            success: true,
            message: "Workflow updated successfully",
            data: workflow
        });
    } catch (error) {
        console.error("Error updating workflow:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Delete workflow
 */
const deleteWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        // Find workflow
        const workflow = await Workflow.findById(id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to delete this workflow"
            });
        }
        
        // Check if workflow is attached to any campaigns
        const campaigns = await Campaign.find({ workflowId: id });
        if (campaigns.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete workflow as it is attached to one or more campaigns"
            });
        }
        
        await Workflow.findByIdAndDelete(id);
        
        res.status(200).json({
            success: true,
            message: "Workflow deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting workflow:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Link workflow to campaign
 */
const linkWorkflowToCampaign = async (req, res) => {
    try {
        const { workflowId, campaignId } = req.body;
        const adminId = req.adminId;
        
        // Validate input
        if (!workflowId || !campaignId) {
            return res.status(400).json({
                success: false,
                message: "Workflow ID and Campaign ID are required"
            });
        }
        
        // Find workflow
        const workflow = await Workflow.findById(workflowId);
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to use this workflow"
            });
        }
        
        // Find campaign
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // Verify that this campaign belongs to the admin
        if (campaign.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this campaign"
            });
        }
        
        // Update campaign with workflow
        campaign.workflowId = workflowId;
        await campaign.save();
        
        res.status(200).json({
            success: true,
            message: "Workflow linked to campaign successfully",
            data: campaign
        });
    } catch (error) {
        console.error("Error linking workflow to campaign:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get all user sessions for a workflow
 */
const getWorkflowSessions = async (req, res) => {
    try {
        const { workflowId } = req.params;
        const adminId = req.adminId;
        
        // Find workflow
        const workflow = await Workflow.findById(workflowId);
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this workflow's sessions"
            });
        }
        
        // Get all sessions for this workflow
        const sessions = await UserSession.find({ workflowId })
            .populate('userId', 'phone name email_id')
            .sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            message: "Workflow sessions fetched successfully",
            data: sessions
        });
    } catch (error) {
        console.error("Error fetching workflow sessions:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get workflow statistics
 */
const getWorkflowStats = async (req, res) => {
    try {
        const { workflowId } = req.params;
        const adminId = req.adminId;
        
        // Find workflow
        const workflow = await Workflow.findById(workflowId);
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }
        
        // Verify that this workflow belongs to the admin
        if (workflow.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this workflow's statistics"
            });
        }
        
        // Get statistics for this workflow
        const stats = {
            totalSessions: await UserSession.countDocuments({ workflowId }),
            completedSessions: await UserSession.countDocuments({ workflowId, status: 'completed' }),
            activeSessions: await UserSession.countDocuments({ workflowId, status: 'active' }),
            abandonedSessions: await UserSession.countDocuments({ workflowId, status: 'abandoned' })
        };
        
        // Calculate completion rate
        stats.completionRate = stats.totalSessions > 0 
            ? (stats.completedSessions / stats.totalSessions) * 100 
            : 0;
        
        res.status(200).json({
            success: true,
            message: "Workflow statistics fetched successfully",
            data: stats
        });
    } catch (error) {
        console.error("Error fetching workflow statistics:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    createWorkflow,
    getAllWorkflows,
    getWorkflowById,
    updateWorkflow,
    deleteWorkflow,
    linkWorkflowToCampaign,
    getWorkflowSessions,
    getWorkflowStats
};