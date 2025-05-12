// controllers/AdminController.js
const { Admin } = require('../models/Admins');
const { AdminTokens } = require('../models/adminTokens');
const { Agent } = require('../models/Agents');
const { Campaign } = require('../models/Campaigns');
const { Product } = require('../models/Products');
const { Workflow } = require('../models/Workflows');
const { Settings } = require('../models/Settings');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { WhatsappNumber } = require('../models/WhatsappNumber');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { refreshFacebookToken, verifyFacebookCredentials } = require('../utils/facebookAuth');

const JWT_SECRET = process.env.JWT_SECRET;

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

const AdminController = {
    // Admin registration
    register: async (req, res) => {
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
                    message: "All required fields must be provided"
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

            // Check if mobile already exists
            const existingMobile = await Admin.findOne({ mobile });
            if (existingMobile) {
                return res.status(400).json({
                    success: false,
                    message: "Admin with this mobile number already exists"
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create admin
            const admin = new Admin({
                first_name,
                last_name,
                business_name,
                mobile,
                email_id,
                password: hashedPassword,
                fb_id,
                fb_password, // Note: In production, this should be encrypted
                status: false // Admin remains inactive until approved by super admin
            });

            await admin.save();

            // Log activity
            await logActivity({
                actorId: admin._id,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'register',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Admin registered: ${admin.email_id}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for super admin
            await createNotification({
                title: 'New Admin Registration',
                description: `${admin.first_name} ${admin.last_name} (${admin.business_name}) has registered and needs approval`,
                type: 'admin_registration',
                forSuperAdmin: true,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high'
            });

            // Remove password from response
            const adminResponse = admin.toObject();
            delete adminResponse.password;
            delete adminResponse.fb_password;

            return res.status(201).json({
                success: true,
                message: "Admin registered successfully. Please wait for super admin approval.",
                data: adminResponse
            });
        } catch (error) {
            console.error("Error in register:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Admin login
    login: async (req, res) => {
        try {
            const { email_id, password } = req.body;

            // Validate required fields
            if (!email_id || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }

            // Find admin by email
            const admin = await Admin.findOne({ email_id });
            if (!admin) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Check if admin is approved
            if (!admin.status) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not approved yet. Please wait for super admin approval."
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, admin.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Check if Facebook access token needs refresh
            if (admin.facebookAccess && admin.facebookAccess.expiresAt) {
                const expiryDate = new Date(admin.facebookAccess.expiresAt);
                const now = new Date();
                const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);

                if (hoursUntilExpiry < 24) {
                    // Refresh token if expiring within 24 hours
                    const refreshResult = await refreshFacebookToken(admin.facebookAccess.refreshToken);
                    if (refreshResult.success) {
                        admin.facebookAccess.accessToken = refreshResult.accessToken;
                        admin.facebookAccess.expiresAt = refreshResult.expiresAt;
                        await admin.save();
                    }
                }
            }

            // Generate JWT token
            const token = jwt.sign(
                { adminId: admin._id },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Create token record
            const adminToken = new AdminTokens({
                adminId: admin._id,
                token,
                tokenType: 'login'
            });

            await adminToken.save();

            // Log activity
            await logActivity({
                actorId: admin._id,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'login',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Admin logged in`,
                adminId: admin._id,
                status: 'success'
            });

            // Remove sensitive data from response
            const adminResponse = admin.toObject();
            delete adminResponse.password;
            delete adminResponse.fb_password;

            return res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    admin: adminResponse,
                    token
                }
            });
        } catch (error) {
            console.error("Error in login:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Logout
    logout: async (req, res) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            const adminId = req.adminId;

            // Delete the token
            await AdminTokens.findOneAndDelete({ token, adminId });

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'logout',
                entityType: 'Admin',
                entityId: adminId,
                description: `Admin logged out`,
                adminId,
                status: 'success'
            });

            return res.status(200).json({
                success: true,
                message: "Logged out successfully"
            });
        } catch (error) {
            console.error("Error in logout:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get admin profile
    getProfile: async (req, res) => {
        try {
            const adminId = req.adminId;

            const admin = await Admin.findById(adminId)
                .select('-password -fb_password')
                .populate('whatsappNumber.number');

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Get additional statistics
            const agentCount = await Agent.countDocuments({ adminId });
            const campaignCount = await Campaign.countDocuments({ adminId });
            const productCount = await Product.countDocuments({ adminId });
            const workflowCount = await Workflow.countDocuments({ adminId });

            return res.status(200).json({
                success: true,
                data: {
                    admin,
                    stats: {
                        agents: agentCount,
                        campaigns: campaignCount,
                        products: productCount,
                        workflows: workflowCount
                    }
                }
            });
        } catch (error) {
            console.error("Error in getProfile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update admin profile
    updateProfile: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                first_name,
                last_name,
                business_name,
                mobile
            } = req.body;

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Check if mobile is being changed to an existing one
            if (mobile && mobile !== admin.mobile) {
                const existingMobile = await Admin.findOne({ 
                    mobile, 
                    _id: { $ne: admin._id } 
                });

                if (existingMobile) {
                    return res.status(400).json({
                        success: false,
                        message: "Mobile number already in use"
                    });
                }
            }

            // Update allowed fields
            if (first_name) admin.first_name = first_name;
            if (last_name) admin.last_name = last_name;
            if (business_name) admin.business_name = business_name;
            if (mobile) admin.mobile = mobile;

            await admin.save();

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'admin_updated',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Admin profile updated`,
                adminId,
                status: 'success'
            });

            // Remove sensitive data from response
            const adminResponse = admin.toObject();
            delete adminResponse.password;
            delete adminResponse.fb_password;

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                data: adminResponse
            });
        } catch (error) {
            console.error("Error in updateProfile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update Facebook credentials
    updateFacebookCredentials: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { fb_id, fb_password } = req.body;

            if (!fb_id || !fb_password) {
                return res.status(400).json({
                    success: false,
                    message: "Facebook ID and password are required"
                });
            }

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Verify new Facebook credentials
            const fbVerification = await verifyFacebookCredentials(fb_id, fb_password);
            
            if (!fbVerification.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to verify Facebook credentials",
                    error: fbVerification.error
                });
            }

            // Update Facebook credentials
            admin.fb_id = fb_id;
            admin.fb_password = fb_password; // Note: Should be encrypted in production
            admin.facebookAccess = {
                accessToken: fbVerification.accessToken,
                refreshToken: fbVerification.refreshToken,
                expiresAt: fbVerification.expiresAt,
                isVerified: true,
                lastVerified: new Date()
            };

            await admin.save();

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'admin_updated',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Facebook credentials updated`,
                adminId,
                status: 'success'
            });

            return res.status(200).json({
                success: true,
                message: "Facebook credentials updated successfully"
            });
        } catch (error) {
            console.error("Error in updateFacebookCredentials:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Change password
    changePassword: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            admin.password = hashedPassword;
            await admin.save();

            // Invalidate all existing tokens
            await AdminTokens.deleteMany({ adminId });

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'password_change',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Admin password changed`,
                adminId,
                status: 'success'
            });

            return res.status(200).json({
                success: true,
                message: "Password changed successfully. Please login again."
            });
        } catch (error) {
            console.error("Error in changePassword:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get admin dashboard stats
    getDashboardStats: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Get agent statistics
            const totalAgents = await Agent.countDocuments({ adminId });
            const activeAgents = await Agent.countDocuments({ adminId, status: true });

            // Get campaign statistics
            const totalCampaigns = await Campaign.countDocuments({ adminId });
            const activeCampaigns = await Campaign.countDocuments({ adminId, status: 'active' });

            // Get product statistics
            const totalProducts = await Product.countDocuments({ adminId });
            const activeProducts = await Product.countDocuments({ adminId, status: 'active' });

            // Get workflow statistics
            const totalWorkflows = await Workflow.countDocuments({ adminId });
            const activeWorkflows = await Workflow.countDocuments({ adminId, isActive: true });

            // Get user statistics
            const User = require('../models/Users').User;
            const totalUsers = await User.countDocuments({ adminId });
            const activeUsers = await User.countDocuments({ adminId, status: 'active' });

            // Get recent activity logs
            const recentActivity = await ActivityLog.find({ adminId })
                .sort({ createdAt: -1 })
                .limit(10);

            // Get revenue statistics
            const Payment = require('../models/Payments').Payment;
            const revenueStats = await Payment.aggregate([
                { $match: { adminId, ...dateFilter, status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$amount" },
                        totalTransactions: { $sum: 1 },
                        avgTransaction: { $avg: "$amount" }
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    agents: {
                        total: totalAgents,
                        active: activeAgents
                    },
                    campaigns: {
                        total: totalCampaigns,
                        active: activeCampaigns
                    },
                    products: {
                        total: totalProducts,
                        active: activeProducts
                    },
                    workflows: {
                        total: totalWorkflows,
                        active: activeWorkflows
                    },
                    users: {
                        total: totalUsers,
                        active: activeUsers
                    },
                    revenue: revenueStats[0] || {
                        totalRevenue: 0,
                        totalTransactions: 0,
                        avgTransaction: 0
                    },
                    recentActivity
                }
            });
        } catch (error) {
            console.error("Error in getDashboardStats:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get admin settings
    getSettings: async (req, res) => {
        try {
            const adminId = req.adminId;

            const settings = await Settings.find({ 
                adminId,
                type: 'admin'
            });

            return res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error("Error in getSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update admin settings
    updateSettings: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { settings } = req.body;

            if (!Array.isArray(settings)) {
                return res.status(400).json({
                    success: false,
                    message: "Settings must be an array"
                });
            }

            const updatedSettings = [];

            for (const setting of settings) {
                const { name, value } = setting;

                if (!name) continue;

                const updatedSetting = await Settings.findOneAndUpdate(
                    { adminId, type: 'admin', name },
                    {
                        value,
                        lastUpdatedBy: {
                            id: adminId,
                            role: 'admin'
                        }
                    },
                    { new: true, upsert: true }
                );

                updatedSettings.push(updatedSetting);
            }

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: null,
                description: `Admin settings updated`,
                adminId,
                status: 'success'
            });

            return res.status(200).json({
                success: true,
                message: "Settings updated successfully",
                data: updatedSettings
            });
        } catch (error) {
            console.error("Error in updateSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get WhatsApp info
    getWhatsAppInfo: async (req, res) => {
        try {
            const adminId = req.adminId;

            const admin = await Admin.findById(adminId);
            
            if (!admin || !admin.whatsappNumber) {
                return res.status(404).json({
                    success: false,
                    message: "WhatsApp number not assigned"
                });
            }

            const whatsappNumber = await WhatsappNumber.findOne({
                phoneNumber: admin.whatsappNumber.number,
                adminId
            });

            if (!whatsappNumber) {
                return res.status(404).json({
                    success: false,
                    message: "WhatsApp number details not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: whatsappNumber
            });
        } catch (error) {
            console.error("Error in getWhatsAppInfo:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = AdminController;