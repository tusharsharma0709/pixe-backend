// 2. CONTROLLERS
// controllers/superadminControllers.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { SuperAdmin } = require('../models/SuperAdmins');
const { SuperAdminTokens } = require('../models/SuperAdminTokens');
const { Admin } = require('../models/Admins');
const { User } = require('../models/Users');
const { Campaign } = require('../models/Campaigns');
const { Workflow } = require('../models/Workflows');
const axios = require('axios');

/**
 * ✅ Register Super Admin
 */
const register = async (req, res) => {
    SuperAdmin.find({email_id: req.body.email_id}).exec().then((superAdmin) => {
        if(superAdmin.length >= 1){
            return res.status(401).json({
                success: false,
                message: "Email ID already exists"
            });
        } else {
            bcrypt.hash(req.body.password, 10, (err, hash) => {
                if(err){
                    return res.status(500).json({
                        success: false,
                        message: "Error, cannot encrypt password"
                    });
                } else {
                    const superAdmin = new SuperAdmin({
                        first_name: req.body.first_name,
                        last_name: req.body.last_name,
                        mobile: req.body.mobile,
                        email_id: req.body.email_id,
                        password: hash,
                    });
                    superAdmin.save().then(() => {   
                        res.status(201).json({
                            success: true,
                            message: "Super Admin Registered Successfully"
                        });
                    }).catch((e) => {
                        res.status(500).json({
                            success: false,
                            message: "Internal Server Error",
                            error: e
                        });
                    });
                }
            });
        }
    });
};

/**
 * ✅ Login Super Admin
 */
const login = async (req, res, next) => {
    SuperAdmin.findOne({email_id: req.body.email_id}).exec()
    .then((superAdmin) => {
        if(!superAdmin){
            return res.status(401).json({
                success: false,
                message: "Super admin not found"
            });
        }
        bcrypt.compare(req.body.password, superAdmin.password, async (err, result) => {
            if(err){
                return res.status(401).json({
                    success: false,
                    message: "Server error, authentication failed"
                });
            }
            if(result){
                const token = jwt.sign(
                    {
                        email_id: superAdmin.email_id,
                        superAdminId: superAdmin._id
                    },
                    process.env.JWT_SECRET
                );
                
                await SuperAdminTokens.findOneAndUpdate(
                    {superAdminId: superAdmin._id, tokenType: "login"}, 
                    {token: token}, 
                    {new: true, upsert: true}
                );
                
                return res.status(200).json({
                    success: true,
                    message: "Login successfully!",
                    data: {
                        token,
                        superAdmin: {
                            _id: superAdmin._id,
                            first_name: superAdmin.first_name,
                            last_name: superAdmin.last_name,
                            email_id: superAdmin.email_id,
                            mobile: superAdmin.mobile
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
 * ✅ Logout Super Admin
 */
const logout = async (req, res) => {
    // Delete the session token or access token associated with the admin
    const superAdmin = await SuperAdmin.findById(req.superAdminId);
    
    const logout = await SuperAdminTokens.findOneAndUpdate(
        {superAdminId: superAdmin._id},
        {$set: {token: null}}
    ).then(result => {
        res.status(200).json({
            success: true,
            message: "Super Admin Logged Out Successfully"
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
 * ✅ Get Super Admin Profile
 */
const getProfile = async (req, res) => {
    SuperAdmin.findOne({_id: req.superAdminId})
    .then(result => {
        const profileData = {
            _id: result._id,
            first_name: result.first_name,
            last_name: result.last_name,
            email_id: result.email_id,
            mobile: result.mobile
        };
        
        res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: profileData
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
 * ✅ Update Super Admin Profile
 */
const updateProfile = async (req, res) => {
    try {
        const { first_name, last_name, mobile } = req.body;
        
        const updatedSuperAdmin = await SuperAdmin.findByIdAndUpdate(
            req.superAdminId,
            {
                $set: {
                    first_name,
                    last_name,
                    mobile
                }
            },
            { new: true }
        );
        
        if (!updatedSuperAdmin) {
            return res.status(404).json({
                success: false,
                message: "Super Admin not found"
            });
        }
        
        const profileData = {
            _id: updatedSuperAdmin._id,
            first_name: updatedSuperAdmin.first_name,
            last_name: updatedSuperAdmin.last_name,
            email_id: updatedSuperAdmin.email_id,
            mobile: updatedSuperAdmin.mobile
        };
        
        res.status(200).json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err
        });
    }
};

/**
 * ✅ Change Password for Super Admin
 */
const changePassword = async (req, res) => {
  try {
      const _id = req.superAdminId;
      const { password, newPassword } = req.body;
      
      // Validate request body
      if (!password || !newPassword) {
          return res.status(400).json({
              success: false, 
              message: 'Please provide both current and new passwords.'
          });
      }

      // Find super admin by ID
      const superAdmin = await SuperAdmin.findById(_id);
      if (!superAdmin) {
          return res.status(404).json({ 
              success: false, 
              message: 'Super Admin not found.' 
          });
      }
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(password, superAdmin.password);
      if (!isValidPassword) {
          return res.status(400).json({ 
              success: false, 
              message: 'Invalid current password.' 
          });
      }

      // Generate a new hashed password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update the super admin's password
      superAdmin.password = hashedPassword;
      await superAdmin.save();
      
      // Delete the existing token to log the user out
      await SuperAdminTokens.findOneAndDelete({ 
          superAdminId: _id, 
          tokenType: "login" 
      });
      
      // Send success response
      res.status(200).json({
          success: true,
          message: 'Password changed successfully. Please log in with your new credentials.'
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
 * ✅ Update Admin Status
 */
const updateAdminStatus = async (req, res) => {
  try {
      const { id } = req.params;
      const { status } = req.body;

      if (typeof status !== "boolean") {
          return res.status(400).json({ 
              success: false, 
              message: "Invalid status value" 
          });
      }

      const admin = await Admin.findByIdAndUpdate(id, { status }, { new: true });

      if (!admin) {
          return res.status(404).json({ 
              success: false, 
              message: "Admin not found" 
          });
      }

      // Modify the response message to include the status
      const statusText = status ? "active" : "inactive";
      
      res.status(200).json({
          success: true,
          message: `Admin status updated successfully to ${statusText}`
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
 * ✅ Get All Admins
 */
const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find({}, {
            password: 0,
            fb_password: 0,
            'facebookAccess.accessToken': 0,
            'facebookAccess.refreshToken': 0
        });

        res.status(200).json({
            success: true,
            message: "Admin list fetched successfully",
            data: admins
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
 * ✅ Get Admin by ID
 */
const getAdminById = async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id, {
            password: 0,
            fb_password: 0,
            'facebookAccess.accessToken': 0,
            'facebookAccess.refreshToken': 0
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Admin details fetched successfully",
            data: admin
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
 * ✅ Get All Users of an Admin
 */
const getAllUsers = async (req, res) => {
    try {
        const { id } = req.params; // Admin ID
        
        // Validate if admin exists
        const adminExists = await Admin.findById(id);
        if (!adminExists) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }
        
        // Get campaigns of this admin
        const campaigns = await Campaign.find({ adminId: id });
        const campaignIds = campaigns.map(campaign => campaign._id);
        
        // Get users linked to these campaigns
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
 * ✅ Get User by ID
 */
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
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
 * ✅ Create Facebook Campaign
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
 * ✅ Get All Campaigns
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
 * ✅ Get Admin Campaigns
 */
const getAdminCampaigns = async (req, res) => {
    try {
        const { adminId } = req.params;

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
 * ✅ Update Campaign Status
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
 * ✅ Delete Campaign
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
 * ✅ Assign Workflow to Campaign
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

module.exports = {
    register,
    login,
    logout,
    updateProfile,
    getProfile,
    changePassword,
    getAllAdmins,
    updateAdminStatus,
    getAdminById,
    getAllUsers,
    getUserById,
    createCampaign,
    getAllCampaigns,
    getAdminCampaigns,
    updateCampaignStatus,
    deleteCampaign,
    assignWorkflowToCampaign
};