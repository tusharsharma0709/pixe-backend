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
    // Admin registration with WhatsApp number
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
                fb_password,
                whatsapp_number
            } = req.body;

            // Validate required fields
            if (!first_name || !last_name || !mobile || !email_id || !password || !fb_id || !fb_password || !whatsapp_number) {
                return res.status(400).json({
                    success: false,
                    message: "All required fields must be provided including WhatsApp number"
                });
            }

            // Validate WhatsApp number format
            const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
            if (!whatsappRegex.test(whatsapp_number)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid WhatsApp number format. Please include country code."
                });
            }

            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ 
                $or: [
                    { email_id: email_id.toLowerCase() },
                    { mobile },
                    { requestedWhatsappNumber: whatsapp_number }
                ]
            });

            if (existingAdmin) {
                if (existingAdmin.email_id === email_id.toLowerCase()) {
                    return res.status(400).json({
                        success: false,
                        message: "Admin with this email already exists"
                    });
                }
                if (existingAdmin.mobile === mobile) {
                    return res.status(400).json({
                        success: false,
                        message: "Admin with this mobile number already exists"
                    });
                }
                if (existingAdmin.requestedWhatsappNumber === whatsapp_number) {
                    return res.status(400).json({
                        success: false,
                        message: "This WhatsApp number is already registered"
                    });
                }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create admin with pending status
            const admin = new Admin({
                first_name,
                last_name,
                business_name,
                mobile,
                email_id: email_id.toLowerCase(),
                password: hashedPassword,
                fb_id,
                fb_password, // Note: In production, this should be encrypted
                requestedWhatsappNumber: whatsapp_number,
                status: false,
                approvalStage: 'pending_review',
                requiresManualReview: true
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
                description: `Admin registered: ${admin.email_id} with WhatsApp: ${whatsapp_number}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for super admin
            await createNotification({
                title: 'New Admin Registration - Requires Review',
                description: `${admin.first_name} ${admin.last_name} (${admin.business_name}) has registered with WhatsApp: ${whatsapp_number}. Facebook credentials need verification.`,
                type: 'admin_registration',
                forSuperAdmin: true,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high',
                metadata: {
                    adminEmail: admin.email_id,
                    whatsappNumber: whatsapp_number,
                    stage: 'pending_review'
                }
            });

            // Remove sensitive data from response
            const adminResponse = admin.toObject();
            delete adminResponse.password;
            delete adminResponse.fb_password;

            return res.status(201).json({
                success: true,
                message: "Registration successful. Your account is under review. You will be notified once approved.",
                data: {
                    id: adminResponse._id,
                    email: adminResponse.email_id,
                    first_name: adminResponse.first_name,
                    last_name: adminResponse.last_name,
                    business_name: adminResponse.business_name,
                    status: adminResponse.status,
                    approvalStage: adminResponse.approvalStage
                }
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
            const admin = await Admin.findOne({ email_id: email_id.toLowerCase() });
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
                    message: "Your account is not approved yet. Please wait for super admin approval.",
                    data: {
                        approvalStage: admin.approvalStage,
                        rejectionReason: admin.rejectionReason
                    }
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

    // Get registration status
    getRegistrationStatus: async (req, res) => {
        try {
            const email_id = req.query.email;

            if (!email_id) {
                return res.status(400).json({
                    success: false,
                    message: "Email is required"
                });
            }

            const admin = await Admin.findOne({ email_id: email_id.toLowerCase() })
                .select('email_id first_name last_name status approvalStage rejectionReason createdAt reviewedAt fb_credentials_verified facebookApp whatsappVerification');

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    email: admin.email_id,
                    name: `${admin.first_name} ${admin.last_name}`,
                    status: admin.status,
                    approvalStage: admin.approvalStage,
                    rejectionReason: admin.rejectionReason,
                    registeredAt: admin.createdAt,
                    reviewedAt: admin.reviewedAt,
                    fbCredentialsVerified: admin.fb_credentials_verified,
                    facebookAppCreated: !!admin.facebookApp,
                    whatsappVerified: admin.whatsappVerification?.isVerified || false
                }
            });
        } catch (error) {
            console.error("Error in getRegistrationStatus:", error);
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
                .populate('reviewedBy', 'first_name last_name email_id');

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

    // Update Facebook credentials (not allowed in new flow)
    updateFacebookCredentials: async (req, res) => {
        try {
            return res.status(403).json({
                success: false,
                message: "Facebook credentials cannot be updated after registration. Please contact super admin for assistance."
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
            
            if (!admin || !admin.whatsappVerification) {
                return res.status(404).json({
                    success: false,
                    message: "WhatsApp not configured for this account"
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    requestedNumber: admin.requestedWhatsappNumber,
                    verifiedNumber: admin.whatsappVerification.phoneNumber,
                    phoneNumberId: admin.whatsappVerification.phoneNumberId,
                    businessAccountId: admin.whatsappVerification.businessAccountId,
                    isVerified: admin.whatsappVerification.isVerified,
                    verifiedAt: admin.whatsappVerification.verifiedAt,
                    facebookApp: admin.facebookApp ? {
                        appName: admin.facebookApp.appName,
                        appId: admin.facebookApp.appId,
                        status: admin.facebookApp.status
                    } : null
                }
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