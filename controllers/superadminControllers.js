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

    // Get all admins with filters
    getAllAdmins: async (req, res) => {
        try {
            const {
                status,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10,
                approvalStage
            } = req.query;

            // Build query
            const query = {};

            if (status !== undefined) query.status = status === 'true';
            if (approvalStage) query.approvalStage = approvalStage;

            if (search) {
                query.$or = [
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { email_id: { $regex: search, $options: 'i' } },
                    { business_name: { $regex: search, $options: 'i' } },
                    { requestedWhatsappNumber: { $regex: search, $options: 'i' } }
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
                .select('-password -fb_password')
                .populate('reviewedBy', 'first_name last_name email_id')
                .populate('facebookApp.createdBySuper', 'first_name last_name')
                .populate('whatsappVerification.verifiedBy', 'first_name last_name')
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

    // Get pending registrations
    getPendingRegistrations: async (req, res) => {
        try {
            const { stage } = req.query;
            
            const filter = { status: false };
            if (stage) {
                filter.approvalStage = stage;
            }

            const pendingAdmins = await Admin.find(filter)
                .select('-password -fb_password')
                .sort({ createdAt: -1 });

            return res.status(200).json({
                success: true,
                data: pendingAdmins
            });
        } catch (error) {
            console.error("Error in getPendingRegistrations:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get admin detail
    getAdminDetail: async (req, res) => {
        try {
            const { adminId } = req.params;

            const admin = await Admin.findById(adminId)
                .select('-password')
                .populate('reviewedBy', 'first_name last_name email');

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: admin
            });
        } catch (error) {
            console.error("Error in getAdminDetail:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Verify Facebook credentials
    verifyFacebookCredentials: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { verified, notes } = req.body;
            const superAdminId = req.superAdminId;

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            if (admin.approvalStage !== 'pending_review') {
                return res.status(400).json({
                    success: false,
                    message: "Admin is not in pending review stage"
                });
            }

            if (verified) {
                admin.fb_credentials_verified = true;
                admin.fb_verification_date = new Date();
                admin.approvalStage = 'fb_verified';
                admin.reviewedBy = superAdminId;
                admin.reviewedAt = new Date();
            } else {
                admin.status = false;
                admin.approvalStage = 'rejected';
                admin.rejectionReason = 'Invalid Facebook credentials';
                admin.reviewedBy = superAdminId;
                admin.reviewedAt = new Date();
            }

            if (notes) {
                admin.superAdminNotes = notes;
            }

            await admin.save();

            // Log activity
            const superAdmin = await SuperAdmin.findById(superAdminId);
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: verified ? 'fb_credentials_verified' : 'fb_credentials_rejected',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Facebook credentials ${verified ? 'verified' : 'rejected'} for admin: ${admin.email_id}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for admin
            await createNotification({
                title: verified ? 'Facebook Credentials Verified' : 'Registration Rejected',
                description: verified 
                    ? 'Your Facebook credentials have been verified. The next step is app creation.'
                    : 'Your registration has been rejected due to invalid Facebook credentials.',
                type: 'registration_update',
                adminId: admin._id,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high'
            });

            return res.status(200).json({
                success: true,
                message: `Facebook credentials ${verified ? 'verified' : 'rejected'} successfully`,
                data: {
                    adminId: admin._id,
                    approvalStage: admin.approvalStage
                }
            });
        } catch (error) {
            console.error("Error in verifyFacebookCredentials:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Create Facebook app
    createFacebookApp: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { appId, appSecret, appName } = req.body;
            const superAdminId = req.superAdminId;

            if (!appId || !appSecret || !appName) {
                return res.status(400).json({
                    success: false,
                    message: "App ID, App Secret, and App Name are required"
                });
            }

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            if (admin.approvalStage !== 'fb_verified') {
                return res.status(400).json({
                    success: false,
                    message: "Facebook credentials must be verified first"
                });
            }

            // Create Facebook app details
            admin.facebookApp = {
                appId,
                appSecret,
                appName,
                status: 'active',
                createdBySuper: superAdminId,
                createdAt: new Date()
            };

            admin.approvalStage = 'app_created';
            admin.reviewedBy = superAdminId;
            admin.reviewedAt = new Date();

            await admin.save();

            // Log activity
            const superAdmin = await SuperAdmin.findById(superAdminId);
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'facebook_app_created',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Facebook app created for admin: ${admin.email_id}`,
                adminId: admin._id,
                status: 'success',
                metadata: { appName, appId }
            });

            // Create notification for admin
            await createNotification({
                title: 'Facebook App Created',
                description: `Your Facebook app "${appName}" has been created successfully. WhatsApp verification is the next step.`,
                type: 'registration_update',
                adminId: admin._id,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high'
            });

            return res.status(200).json({
                success: true,
                message: "Facebook app created successfully",
                data: {
                    adminId: admin._id,
                    appName: appName,
                    approvalStage: admin.approvalStage
                }
            });
        } catch (error) {
            console.error("Error in createFacebookApp:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Verify WhatsApp number
    verifyWhatsAppNumber: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { phoneNumberId, businessAccountId, verified, notes } = req.body;
            const superAdminId = req.superAdminId;

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            if (admin.approvalStage !== 'app_created') {
                return res.status(400).json({
                    success: false,
                    message: "Facebook app must be created first"
                });
            }

            if (verified) {
                if (!phoneNumberId || !businessAccountId) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone Number ID and Business Account ID are required for verification"
                    });
                }

                admin.whatsappVerification = {
                    phoneNumber: admin.requestedWhatsappNumber,
                    phoneNumberId,
                    businessAccountId,
                    isVerified: true,
                    verifiedBy: superAdminId,
                    verifiedAt: new Date(),
                    lastChecked: new Date()
                };

                admin.approvalStage = 'whatsapp_verified';
                admin.status = true; // Activate admin account
                admin.reviewedBy = superAdminId;
                admin.reviewedAt = new Date();
            } else {
                admin.status = false;
                admin.approvalStage = 'rejected';
                admin.rejectionReason = 'WhatsApp verification failed';
                admin.reviewedBy = superAdminId;
                admin.reviewedAt = new Date();
            }

            if (notes) {
                admin.superAdminNotes = (admin.superAdminNotes || '') + '\n' + notes;
            }

            await admin.save();

            // Log activity
            const superAdmin = await SuperAdmin.findById(superAdminId);
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: verified ? 'whatsapp_verified' : 'whatsapp_rejected',
                entityType: 'Admin',
                entityId: admin._id,
                description: `WhatsApp ${verified ? 'verified' : 'verification failed'} for admin: ${admin.email_id}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for admin
            await createNotification({
                title: verified ? 'Account Approved!' : 'Registration Rejected',
                description: verified 
                    ? 'Your account has been approved. You can now login to your dashboard.'
                    : 'Your registration has been rejected due to WhatsApp verification failure.',
                type: 'registration_update',
                adminId: admin._id,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high'
            });

            return res.status(200).json({
                success: true,
                message: verified ? "Admin account approved successfully" : "WhatsApp verification failed",
                data: {
                    adminId: admin._id,
                    status: admin.status,
                    approvalStage: admin.approvalStage
                }
            });
        } catch (error) {
            console.error("Error in verifyWhatsAppNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Reject registration
    rejectRegistration: async (req, res) => {
        try {
            const { adminId } = req.params;
            const { reason, notes } = req.body;
            const superAdminId = req.superAdminId;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: "Rejection reason is required"
                });
            }

            const admin = await Admin.findById(adminId);

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            admin.status = false;
            admin.approvalStage = 'rejected';
            admin.rejectionReason = reason;
            admin.reviewedBy = superAdminId;
            admin.reviewedAt = new Date();

            if (notes) {
                admin.superAdminNotes = notes;
            }

            await admin.save();

            // Log activity
            const superAdmin = await SuperAdmin.findById(superAdminId);
            await logActivity({
                actorId: superAdminId,
                actorModel: 'SuperAdmins',
                actorName: superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null,
                action: 'registration_rejected',
                entityType: 'Admin',
                entityId: admin._id,
                description: `Registration rejected for admin: ${admin.email_id}. Reason: ${reason}`,
                adminId: admin._id,
                status: 'success'
            });

            // Create notification for admin
            await createNotification({
                title: 'Registration Rejected',
                description: `Your registration has been rejected. Reason: ${reason}`,
                type: 'registration_update',
                adminId: admin._id,
                relatedTo: {
                    model: 'Admin',
                    id: admin._id
                },
                priority: 'high'
            });

            return res.status(200).json({
                success: true,
                message: "Registration rejected successfully",
                data: {
                    adminId: admin._id,
                    status: admin.status,
                    approvalStage: admin.approvalStage
                }
            });
        } catch (error) {
            console.error("Error in rejectRegistration:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Review admin (deprecated - use specific methods above)
    reviewAdmin: async (req, res) => {
        return res.status(400).json({
            success: false,
            message: "This endpoint is deprecated. Please use specific verification endpoints."
        });
    },

    // Assign WhatsApp number (deprecated in new flow)
    assignWhatsAppNumber: async (req, res) => {
        return res.status(400).json({
            success: false,
            message: "WhatsApp numbers are now verified during the registration approval process. Use the verifyWhatsAppNumber endpoint instead."
        });
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
            const pendingAdmins = await Admin.countDocuments({ status: false, approvalStage: { $ne: 'rejected' } });
            const rejectedAdmins = await Admin.countDocuments({ approvalStage: 'rejected' });

            // Get admin statistics by approval stage
            const adminsByStage = await Admin.aggregate([
                { $group: { _id: "$approvalStage", count: { $sum: 1 } } }
            ]);

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
                .limit(10)
                .populate('actorId', 'first_name last_name email_id');

            // Get pending registrations count by stage
            const pendingRegistrations = await Admin.aggregate([
                { $match: { status: false, approvalStage: { $ne: 'rejected' } } },
                { $group: { _id: "$approvalStage", count: { $sum: 1 } } }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    admins: {
                        total: totalAdmins,
                        active: activeAdmins,
                        pending: pendingAdmins,
                        rejected: rejectedAdmins,
                        byStage: adminsByStage
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
                    pendingRegistrations: pendingRegistrations,
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

    // Get all WhatsApp numbers (modified for new flow)
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

            // Build query based on new structure
            const pipeline = [];
            // Match stage
           const matchConditions = { status: true }; // Only show approved admins
           if (adminId) matchConditions._id = new ObjectId(adminId);

           if (search) {
               matchConditions.$or = [
                   { requestedWhatsappNumber: { $regex: search, $options: 'i' } },
                   { 'whatsappVerification.phoneNumber': { $regex: search, $options: 'i' } },
                   { first_name: { $regex: search, $options: 'i' } },
                   { last_name: { $regex: search, $options: 'i' } },
                   { business_name: { $regex: search, $options: 'i' } }
               ];
           }

           pipeline.push({ $match: matchConditions });
           
           // Project to get WhatsApp details
           pipeline.push({
               $project: {
                   adminId: '$_id',
                   adminName: { $concat: ['$first_name', ' ', '$last_name'] },
                   businessName: '$business_name',
                   requestedNumber: '$requestedWhatsappNumber',
                   verifiedNumber: '$whatsappVerification.phoneNumber',
                   phoneNumberId: '$whatsappVerification.phoneNumberId',
                   businessAccountId: '$whatsappVerification.businessAccountId',
                   isVerified: '$whatsappVerification.isVerified',
                   verifiedAt: '$whatsappVerification.verifiedAt',
                   facebookApp: '$facebookApp',
                   createdAt: '$createdAt'
               }
           });

           // Only show admins with verified WhatsApp
           pipeline.push({
               $match: { isVerified: true }
           });

           // Sort
           const sortField = sortBy || 'createdAt';
           const sortDirection = sortOrder === 'asc' ? 1 : -1;
           pipeline.push({ $sort: { [sortField]: sortDirection } });

           // Pagination
           const skip = (parseInt(page) - 1) * parseInt(limit);
           
           // Count total records
           const countPipeline = [...pipeline];
           countPipeline.push({ $count: 'total' });
           const countResult = await Admin.aggregate(countPipeline);
           const totalCount = countResult[0]?.total || 0;

           // Add skip and limit for pagination
           pipeline.push({ $skip: skip });
           pipeline.push({ $limit: parseInt(limit) });

           // Execute aggregation
           const whatsappNumbers = await Admin.aggregate(pipeline);

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