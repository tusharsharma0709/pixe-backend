// controllers/SuperAdminController.js
const { SuperAdmin } = require('../models/SuperAdmins');
const { SuperAdminTokens } = require('../models/SuperAdminTokens');
const { Admin } = require('../models/Admins');
const { Campaign } = require('../models/Campaigns');
const { Product } = require('../models/Products');
const { Statistic } = require('../models/Statistics');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { WhatsappNumber } = require('../models/WhatsappNumber');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { verifyFacebookCredentials } = require('../utils/facebookAuth');

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

const SuperAdminController = {
    // Super Admin registration
    register: async (req, res) => {
        try {
            const { first_name, last_name, mobile, email_id, password } = req.body;

            // Validate required fields
            if (!first_name || !last_name || !mobile || !email_id || !password) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required"
                });
            }

            // Check if super admin already exists
            const existingSuperAdmin = await SuperAdmin.findOne({ email_id });
            if (existingSuperAdmin) {
                return res.status(400).json({
                    success: false,
                    message: "Super admin with this email already exists"
                });
            }

            // Check if mobile already exists
            const existingMobile = await SuperAdmin.findOne({ mobile });
            if (existingMobile) {
                return res.status(400).json({
                    success: false,
                    message: "Super admin with this mobile number already exists"
                });
            }

            // Check if this is the first super admin
            const superAdminCount = await SuperAdmin.countDocuments();
            if (superAdminCount > 0) {
                // Only allow registration if already authenticated as super admin
                if (!req.superAdminId) {
                    return res.status(403).json({
                        success: false,
                        message: "Only existing super admin can create new super admin accounts"
                    });
                }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create super admin
            const superAdmin = new SuperAdmin({
                first_name,
                last_name,
                mobile,
                email_id,
                password: hashedPassword
            });

            await superAdmin.save();

            // Log activity
            await logActivity({
                actorId: superAdmin._id,
                actorModel: 'SuperAdmins',
                actorName: `${superAdmin.first_name} ${superAdmin.last_name}`,
                action: 'register',
                entityType: 'SuperAdmin',
                entityId: superAdmin._id,
                description: `Super admin registered: ${superAdmin.email_id}`,
                status: 'success'
            });

            // Remove password from response
            const superAdminResponse = superAdmin.toObject();
            delete superAdminResponse.password;

            return res.status(201).json({
                success: true,
                message: "Super admin registered successfully",
                data: superAdminResponse
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

    // Super Admin login
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

            // Find super admin by email
            const superAdmin = await SuperAdmin.findOne({ email_id });
            if (!superAdmin) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { superAdminId: superAdmin._id },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Create token record
            const superAdminToken = new SuperAdminTokens({
                superAdminId: superAdmin._id,
                token,
                tokenType: 'login'
            });

            await superAdminToken.save();

            // Log activity
            await logActivity({
                actorId: superAdmin._id,
                actorModel: 'SuperAdmins',
                actorName: `${superAdmin.first_name} ${superAdmin.last_name}`,
                action: 'login',
                entityType: 'SuperAdmin',
                entityId: superAdmin._id,
                description: `Super admin logged in`,
                status: 'success'
            });

            // Remove password from response
            const superAdminResponse = superAdmin.toObject();
            delete superAdminResponse.password;

            return res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    superAdmin: superAdminResponse,
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
            const superAdminId = req.superAdminId;

            // Delete the token
            await SuperAdminTokens.findOneAndDelete({ token, superAdminId });

            // Log activity
            const superAdmin = await SuperAdmin.findById(superAdminId);
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'logout',
                entityType: 'SuperAdmin',
                entityId: superAdminId,
                description: `Super admin logged out`,
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

    // Get all admins
    getAllAdmins: async (req, res) => {
        try {
            const {
                status,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = {};

            if (typeof status === 'boolean') query.status = status;

            if (search) {
                query.$or = [
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { email_id: { $regex: search, $options: 'i' } },
                    { business_name: { $regex: search, $options: 'i' } }
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
            const totalCount = await Admin.countDocuments(query);

            // Execute query with pagination
            const admins = await Admin.find(query)
                .select('-password')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get additional stats for each admin
            const adminsWithStats = await Promise.all(
                admins.map(async (admin) => {
                    const campaignCount = await Campaign.countDocuments({
                        adminId: admin._id
                    });

                    const productCount = await Product.countDocuments({
                        adminId: admin._id
                    });

                    return {
                        ...admin.toObject(),
                        stats: {
                            campaignCount,
                            productCount
                        }
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: adminsWithStats,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAllAdmins:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Approve or reject admin
    reviewAdmin: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { action, rejectionReason, notes } = req.body;
            const superAdminId = req.superAdminId;

            // Validate action
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid action. Must be 'approve' or 'reject'"
                });
            }

            // Find admin
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Check if already processed
            if (admin.status && action === 'approve') {
                return res.status(400).json({
                    success: false,
                    message: "Admin is already approved"
                });
            }

            // Verify Facebook credentials
            try {
                const fbVerification = await verifyFacebookCredentials(admin.fb_id, admin.fb_password);
                
                if (!fbVerification.success) {
                    return res.status(400).json({
                        success: false,
                        message: "Facebook credentials could not be verified",
                        error: fbVerification.error
                    });
                }

                // Update Facebook access data
                admin.facebookAccess = {
                    accessToken: fbVerification.accessToken,
                    refreshToken: fbVerification.refreshToken,
                    expiresAt: fbVerification.expiresAt,
                    isVerified: true,
                    lastVerified: new Date()
                };
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to verify Facebook credentials",
                    error: error.message
                });
            }

            // Update admin based on action
            if (action === 'approve') {
                admin.status = true;
                admin.approvedAt = new Date();
                admin.assignedBy = superAdminId;
                admin.superAdminNotes = notes;
            } else {
                admin.status = false;
                admin.rejectionReason = rejectionReason || 'Rejected by super admin';
                admin.superAdminNotes = notes;
            }

            await admin.save();

            // Get super admin details for logging
            const superAdmin = await SuperAdmin.findById(superAdminId);

            // Log activity
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: action === 'approve' ? 'admin_approved' : 'admin_rejected',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Admin ${action}d: ${admin.first_name} ${admin.last_name}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for admin
            await createNotification({
                title: `Your account has been ${action}d`,
                description: action === 'approve' 
                    ? 'You can now login to your account' 
                    : `Reason: ${rejectionReason || 'Not specified'}`,
                type: action === 'approve' ? 'admin_approval' : 'admin_rejection',
                priority: 'high',
                forAdmin: admin._id
            });

            return res.status(200).json({
                success: true,
                message: `Admin ${action}d successfully`,
                data: admin
            });
        } catch (error) {
            console.error("Error in reviewAdmin:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Assign WhatsApp number to admin
    assignWhatsAppNumber: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { whatsappNumber, displayName, businessName } = req.body;
            const superAdminId = req.superAdminId;

            // Validate required fields
            if (!whatsappNumber || !displayName) {
                return res.status(400).json({
                    success: false,
                    message: "WhatsApp number and display name are required"
                });
            }

            // Find admin
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Check if admin is approved
            if (!admin.status) {
                return res.status(400).json({
                    success: false,
                    message: "Admin must be approved before assigning WhatsApp number"
                });
            }

            // Check if WhatsApp number already exists and is available
            let whatsappNumberDoc = await WhatsappNumber.findOne({ phoneNumber: whatsappNumber });
            
            if (whatsappNumberDoc && whatsappNumberDoc.adminId && whatsappNumberDoc.adminId.toString() !== adminId) {
                return res.status(400).json({
                    success: false,
                    message: "This WhatsApp number is already assigned to another admin"
                });
            }

            if (!whatsappNumberDoc) {
                // Create new WhatsApp number record
                whatsappNumberDoc = new WhatsappNumber({
                    phoneNumber: whatsappNumber,
                    displayName,
                    businessName: businessName || admin.business_name,
                    superAdminId,
                    status: 'active',
                    assignedBy: superAdminId,
                    assignedAt: new Date()
                });
            }

            // Assign to admin
            whatsappNumberDoc.adminId = adminId;
            whatsappNumberDoc.assignedAt = new Date();
            whatsappNumberDoc.assignedBy = superAdminId;
            await whatsappNumberDoc.save();

            // Update admin with WhatsApp number
            admin.whatsappNumber = {
                number: whatsappNumber,
                isActive: true,
                assignedAt: new Date()
            };
            await admin.save();

            // Get super admin details for logging
            const superAdmin = await SuperAdmin.findById(superAdminId);

            // Log activity
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'system',
                entityType: 'WhatsappNumber',
                entityId: whatsappNumberDoc._id,
                description: `WhatsApp number assigned: ${whatsappNumber} to ${admin.first_name} ${admin.last_name}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for admin
            await createNotification({
                title: "WhatsApp Number Assigned",
                description: `Your WhatsApp number ${whatsappNumber} has been assigned and is ready to use`,
                type: 'system',
                priority: 'high',
                forAdmin: admin._id
            });

            return res.status(200).json({
                success: true,
                message: "WhatsApp number assigned successfully",
                data: {
                    whatsappNumber: whatsappNumberDoc,
                    admin: admin
                }
            });
        } catch (error) {
            console.error("Error in assignWhatsAppNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Get admin statistics
            const totalAdmins = await Admin.countDocuments();
            const activeAdmins = await Admin.countDocuments({ status: true });
            const pendingAdmins = await Admin.countDocuments({ status: false });

            // Get campaign statistics
            const totalCampaigns = await Campaign.countDocuments();
            const activeCampaigns = await Campaign.countDocuments({ status: 'active' });

            // Get product statistics
            const totalProducts = await Product.countDocuments();
            const activeProducts = await Product.countDocuments({ status: 'active' });

            // Get recent statistics
            const recentStats = await Statistic.find(dateFilter)
                .sort({ date: -1 })
                .limit(30);

            // Get revenue statistics
            const Payment = require('../models/Payments').Payment;
            const revenueStats = await Payment.aggregate([
                { $match: { ...dateFilter, status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$amount" },
                        totalTransactions: { $sum: 1 },
                        avgTransaction: { $avg: "$amount" }
                    }
                }
            ]);

            // Get recent activity logs
            const recentActivities = await ActivityLog.find()
                .sort({ createdAt: -1 })
                .limit(10);

            return res.status(200).json({
                success: true,
                data: {
                    admins: {
                        total: totalAdmins,
                        active: activeAdmins,
                        pending: pendingAdmins
                    },
                    campaigns: {
                        total: totalCampaigns,
                        active: activeCampaigns
                    },
                    products: {
                        total: totalProducts,
                        active: activeProducts
                    },
                    revenue: revenueStats[0] || {
                        totalRevenue: 0,
                        totalTransactions: 0,
                        avgTransaction: 0
                    },
                    recentStats,
                    recentActivities
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

    // Get system settings
    getSystemSettings: async (req, res) => {
        try {
            const Settings = require('../models/Settings').Settings;
            
            const systemSettings = await Settings.find({ type: 'system' });

            return res.status(200).json({
                success: true,
                data: systemSettings
            });
        } catch (error) {
            console.error("Error in getSystemSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update system settings
    updateSystemSettings: async (req, res) => {
        try {
            const { settings } = req.body;
            const superAdminId = req.superAdminId;

            if (!Array.isArray(settings)) {
                return res.status(400).json({
                    success: false,
                    message: "Settings must be an array"
                });
            }

            const Settings = require('../models/Settings').Settings;
            const updatedSettings = [];

            for (const setting of settings) {
                const { name, value } = setting;

                if (!name) continue;

                const updatedSetting = await Settings.findOneAndUpdate(
                    { type: 'system', name },
                    {
                        value,
                        lastUpdatedBy: {
                            id: superAdminId,
                            role: 'superadmin'
                        }
                    },
                    { new: true, upsert: true }
                );

                updatedSettings.push(updatedSetting);
            }

            // Get super admin details for logging
            const superAdmin = await SuperAdmin.findById(superAdminId);

            // Log activity
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: null,
                description: `System settings updated`,
                status: 'success'
            });

            return res.status(200).json({
                success: true,
                message: "System settings updated successfully",
                data: updatedSettings
            });
        } catch (error) {
            console.error("Error in updateSystemSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all WhatsApp numbers
    getAllWhatsAppNumbers: async (req, res) => {
        try {
            const {
                status,
                adminId,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = {};

            if (status) query.status = status;
            if (adminId) query.adminId = adminId;

            if (search) {
                query.$or = [
                    { phoneNumber: { $regex: search, $options: 'i' } },
                    { displayName: { $regex: search, $options: 'i' } },
                    { businessName: { $regex: search, $options: 'i' } }
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
            const totalCount = await WhatsappNumber.countDocuments(query);

            // Execute query with pagination
            const whatsappNumbers = await WhatsappNumber.find(query)
                .populate('adminId', 'first_name last_name business_name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: whatsappNumbers,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAllWhatsAppNumbers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = SuperAdminController;