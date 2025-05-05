// 2. CONTROLLERS
// controllers/adminControllers.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { Admin } = require('../models/Admins');
const { AdminTokens } = require('../models/adminTokens');
const { User } = require('../models/Users');
const { Campaign } = require('../models/Campaigns');
const { Workflow } = require('../models/Workflows');
const axios = require('axios');

// Register admin with all details
const register = async (req, res) => {
    try {
        const { 
            first_name, 
            last_name, 
            business_name,
            mobile, 
            email_id, 
            password, 
            fb_id, 
            fb_password 
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !mobile || !email_id || !password || !fb_id || !fb_password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email_id });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin with this email already exists"
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new admin object (don't save yet)
        const newAdmin = new Admin({
            first_name,
            last_name,
            business_name,
            mobile,
            email_id,
            password: hashedPassword,
            fb_id,
            fb_password,
            status: false // Admin starts inactive until approved by super admin
        });

        // Verify Facebook credentials before saving
        let facebookVerified = false;
        try {
            const verificationResult = await verifyFacebookLogin(fb_id, fb_password);
            
            if (verificationResult.success) {
                // Set Facebook verification status
                newAdmin.facebookAccess = {
                    accessToken: `verification_token_${Date.now()}`, // Placeholder token
                    refreshToken: null,
                    expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days
                    isVerified: true
                };
                
                facebookVerified = true;
            }
        } catch (error) {
            console.error("Error verifying Facebook credentials:", error);
            // Continue with registration even if Facebook verification fails
        }

        // Save the admin
        await newAdmin.save();

        // Create notification for super admin
        await Notification.create({
            title: "New Admin Registration",
            description: `${first_name} ${last_name} has registered as an admin`,
            type: "admin_registration",
            isRead: false
        });

        // Prepare response (remove sensitive data)
        const adminResponse = newAdmin.toObject();
        delete adminResponse.password;
        delete adminResponse.fb_password;
        delete adminResponse.facebookAccess?.accessToken;
        delete adminResponse.facebookAccess?.refreshToken;

        // Return appropriate response
        res.status(201).json({
            success: true,
            message: facebookVerified 
                ? "Admin registered and Facebook credentials verified successfully. Awaiting approval." 
                : "Admin registered successfully. Facebook verification failed. Awaiting approval.",
            data: {
                admin: {
                    _id: adminResponse._id,
                    first_name: adminResponse.first_name,
                    last_name: adminResponse.last_name,
                    email_id: adminResponse.email_id,
                    fb_id: adminResponse.fb_id,
                    status: adminResponse.status,
                    facebookVerified: facebookVerified
                }
            }
        });
    } catch (error) {
        console.error("Error registering admin:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Facebook login verification helper function
const verifyFacebookLogin = async (username, password) => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        await page.goto('https://www.facebook.com/login');
        
        await page.type('#email', username);
        await page.type('#pass', password);
        
        await Promise.all([
            page.click('[data-testid="royal_login_button"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        
        // Check if login was successful by looking at the URL or page content
        const url = page.url();
        const pageContent = await page.content();
        
        const isLoggedIn = !url.includes('/login') && 
                          !pageContent.includes('Incorrect password') && 
                          !pageContent.includes('The email or mobile number you entered isn');
        
        await browser.close();
        
        if (isLoggedIn) {
            return {
                success: true,
                userId: username
            };
        } else {
            return {
                success: false,
                error: 'Login failed - incorrect credentials'
            };
        }
    } catch (error) {
        console.error('Error in Facebook login verification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * ✅ Login Admin
 */
const login = async (req, res, next) => {
    Admin.findOne({email_id: req.body.email_id}).exec()
    .then((admin) => {
        if(!admin){
            return res.status(401).json({
                success: false,
                message: "Admin not found"
            });
        }
        bcrypt.compare(req.body.password, admin.password, async (err, result) => {
            if(err){
                return res.status(401).json({
                    success: false,
                    message: "Server error, authentication failed"
                });
            }
            if(result){
                const token = jwt.sign(
                    {
                        email_id: admin.email_id,
                        adminId: admin._id
                    },
                    process.env.JWT_SECRET
                );
                
                await AdminTokens.findOneAndUpdate(
                    {adminId: admin._id, tokenType: "login"}, 
                    {token: token}, 
                    {new: true, upsert: true}
                );
                
                return res.status(200).json({
                    success: true,
                    message: "Login successfully!",
                    data: {
                        token,
                        admin: {
                            _id: admin._id,
                            first_name: admin.first_name,
                            last_name: admin.last_name,
                            email_id: admin.email_id,
                            mobile: admin.mobile,
                            status: admin.status,
                            hasFacebookCredentials: !!(admin.fb_id && admin.fb_password),
                            isFacebookVerified: admin.facebookAccess?.isVerified || false
                        }
                    }
                });
            }
            return res.status(401).json({
                success: false,
                message: "Wrong password, login failed"
            });
        });
    })
    .catch((err) => {
        res.status(500).json({
            success: false,
            message: "Server error, authentication failed"
        });
    });
};

/**
 * ✅ Logout Admin
 */
const logout = async (req, res) => {
    // Delete the session token or access token associated with the admin
    const admin = await Admin.findById(req.adminId);
    
    const logout = await AdminTokens.findOneAndUpdate(
        {adminId: admin._id},
        {$set: {token: null}}
    ).then(result => {
        res.status(200).json({
            success: true,
            message: "Admin Logged Out Successfully"
        });
    })
    .catch(err => {
        res.status(500).json({
            success: false,
            message: "Internal Server error",
            error: err
        });
    });
};

/**
 * ✅ Get Admin Profile
 */
const Profile = async (req, res) => {
    Admin.findOne({_id: req.adminId})
    .then(result => {
        // Remove sensitive data
        const adminData = {
            _id: result._id,
            first_name: result.first_name,
            last_name: result.last_name,
            email_id: result.email_id,
            mobile: result.mobile,
            status: result.status,
            hasFacebookCredentials: !!(result.fb_id && result.fb_password),
            isFacebookVerified: result.facebookAccess?.isVerified || false
        };
        
        res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: adminData
        });
    })
    .catch(err => {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err
        });
    });
};

/**
 * ✅ Update Admin Profile
 */
const updateProfile = async (req, res) => {
    const { first_name, last_name, mobile } = req.body;
    
    // Validate input
    if (!first_name && !last_name && !mobile) {
        return res.status(400).json({
            success: false,
            message: "At least one field is required to update"
        });
    }
    
    // Build update object
    const updateFields = {};
    if (first_name) updateFields.first_name = first_name;
    if (last_name) updateFields.last_name = last_name;
    if (mobile) updateFields.mobile = mobile;
    
    Admin.findOneAndUpdate(
        {_id: req.adminId},
        {$set: updateFields},
        {new: true}
    )
    .then(result => {
        res.status(200).json({
            success: true,
            message: "Admin profile updated successfully",
        });
    })
    .catch(err => {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err
        });
    });
};

/**
 * ✅ Update Facebook Credentials
 */
const updateFacebookCredentials = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { fb_id, fb_password } = req.body;

        // Input validation
        if (!fb_id || !fb_password) {
            return res.status(400).json({
                success: false,
                message: "Facebook ID and password are required"
            });
        }

        // Retrieve admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Update admin with Facebook credentials only
        admin.fb_id = fb_id;
        admin.fb_password = fb_password;
        
        await admin.save();

        // Don't return the sensitive credentials in the response
        const adminResponse = admin.toObject();
        delete adminResponse.fb_password;

        res.status(200).json({
            success: true,
            message: "Facebook credentials updated successfully"
        });
    } catch (error) {
        console.error("Error updating Facebook credentials:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get Facebook Credentials Status
 */
const getFacebookStatus = async (req, res) => {
    try {
        const adminId = req.adminId;

        // Retrieve admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Prepare response without sensitive information
        const response = {
            hasFacebookCredentials: !!(admin.fb_id && admin.fb_password),
            isVerified: admin.facebookAccess?.isVerified || false,
            status: admin.status
        };

        res.status(200).json({
            success: true,
            message: "Facebook status retrieved successfully",
            data: response
        });
    } catch (error) {
        console.error("Error getting Facebook status:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Change Password
 */
const changePassword = async (req, res) => {
    try {
        const _id = req.adminId;
        const { password, newPassword } = req.body;
        
        // Validate request body
        if (!password || !newPassword) {
            return res.status(400).json({
                success: false, 
                message: 'Please provide both current and new passwords.'
            });
        }

        // Find admin by ID
        const admin = await Admin.findById(_id);
        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Admin not found.'
            });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Invalid current password.'
            });
        }

        // Generate a new hashed password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update the admin's password
        admin.password = hashedPassword;
        await admin.save();
        
        // Send success response
        res.status(200).json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'An error occurred while changing the password.',
            error: error.message
        });
    }
};

/**
 * ✅ Get Admin Campaigns
 */
const getAdminCampaigns = async (req, res) => {
    try {
        const adminId = req.adminId;
        
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
 * ✅ Get All Users
 */
const getAllUsers = async (req, res) => {
    try {
        const adminId = req.adminId;
        
        // Get campaigns for this admin
        const campaigns = await Campaign.find({ adminId });
        const campaignIds = campaigns.map(campaign => campaign._id);
        
        // Get users associated with these campaigns
        const users = await User.find({ campaignId: { $in: campaignIds } });

        res.status(200).json({
            success: true,
            message: "Users list fetched successfully",
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * ✅ Update User Status
 */
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (typeof status !== "boolean") {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid status value" 
            });
        }

        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }
        
        // Verify that this user is associated with one of the admin's campaigns
        const adminId = req.adminId;
        const campaigns = await Campaign.find({ adminId });
        const campaignIds = campaigns.map(campaign => campaign._id.toString());
        
        if (user.campaignId && !campaignIds.includes(user.campaignId.toString())) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this user"
            });
        }

        user.status = status;
        await user.save();

        res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: user
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Internal server error", 
            error: error.message 
        });
    }
};

/**
 * ✅ Get User by ID
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Verify that this user is associated with one of the admin's campaigns
        const campaigns = await Campaign.find({ adminId });
        const campaignIds = campaigns.map(campaign => campaign._id.toString());
        
        if (user.campaignId && !campaignIds.includes(user.campaignId.toString())) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this user"
            });
        }

        res.status(200).json({
            success: true,
            message: "User details fetched successfully",
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * ✅ Create Workflow
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
 * ✅ Get All Workflows
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
 * ✅ Get Workflow by ID
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
 * ✅ Update Workflow
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
 * ✅ Delete Workflow
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
 * ✅ Link Workflow to Campaign
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

module.exports = {
    register,
    login,
    logout,
    Profile,
    updateProfile,
    updateFacebookCredentials,
    getFacebookStatus,
    changePassword,
    getAdminCampaigns,
    getAllUsers,
    updateUserStatus,
    getUserById,
    createWorkflow,
    getAllWorkflows,
    getWorkflowById,
    updateWorkflow,
    deleteWorkflow,
    linkWorkflowToCampaign
};