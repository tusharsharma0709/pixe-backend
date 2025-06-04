// controllers/UserController.js
const { User } = require('../models/Users');
const { UserToken } = require('../models/userTokens');
const { UserSession } = require('../models/UserSessions');
const { LeadAssignment } = require('../models/LeadAssignments');
const { Campaign } = require('../models/Campaigns');
const { Workflow } = require('../models/Workflows');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { Message } = require('../models/Messages');
const { Order } = require('../models/Orders');
const { Payment } = require('../models/Payments');
const { Verification } = require('../models/Verifications');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
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

// Helper function to generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// services/whatsappService.js
const axios = require('axios');

const sendOTP = async (phoneNumber, otp) => {
    try {
        // Format phone number (ensure it has country code)
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        
        // WhatsApp Business API endpoint
        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        // Message payload for otp_template
        const payload = {
            messaging_product: "whatsapp",
            to: formattedPhone.replace('+', ''), // WhatsApp API expects number without +
            type: "template",
            template: {
                name: "otp_template",
                language: {
                    code: "en_US"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: otp  // Only one parameter for the body
                            }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            {
                                type: "text",
                                text: otp // Parameter for the URL button
                            }
                        ]
                    }
                ]
            }
        };

        // Send message via WhatsApp API
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('OTP sent via WhatsApp:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending OTP via WhatsApp:', error.response?.data || error);
        throw error;
    }
};

const UserController = {

    // User registration/login via phone
registerOrLogin: async (req, res) => {
    try {
        const { phone,source } = req.body;

        // Validate required fields
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }

        // Find or create user
        let user = await User.findOne({ phone });
        
        if (!user) {
            // Get admin and workflow information if campaign ID is provided
            // let adminId = null;
            // if (campaignId) {
            //     const campaign = await Campaign.findById(campaignId);
            //     if (campaign) {
            //         adminId = campaign.adminId;
            //     }
            // } else if (workflowId) {
            //     const workflow = await Workflow.findById(workflowId);
            //     if (workflow) {
            //         adminId = workflow.adminId;
            //     }
            // }

            // Create new user
            user = new User({
                phone,
                // campaignId,
                // workflowId,
                // productId,
                // adminId,
                source: source || 'whatsapp',
                status: 'new'
            });
            await user.save();

            // Log activity
            await logActivity({
                actorId: user._id,
                actorModel: 'Users',
                actorName: user.phone,
                action: 'register',
                entityType: 'User',
                entityId: user._id,
                description: `User registered with phone: ${user.phone}`,
                // adminId: user.adminId
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Update user with OTP
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.isOtpVerified = false;
        await user.save();

        // Send OTP via WhatsApp
        try {
            await sendOTP(phone, otp);
        } catch (whatsappError) {
            console.error('WhatsApp OTP sending failed:', whatsappError);
            // You might want to handle this error differently
            // For now, we'll continue but log the error
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully via WhatsApp",
            data: {
                userId: user._id,
                phone: user.phone,
                // Remove this in production - only for testing
                otp: process.env.NODE_ENV === 'development' ? otp : undefined
            }
        });
    } catch (error) {
        console.error("Error in registerOrLogin:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
},
    // Verify OTP
    verifyOTP: async (req, res) => {
        try {
            const { phone, otp } = req.body;

            if (!phone || !otp) {
                return res.status(400).json({
                    success: false,
                    message: "Phone and OTP are required"
                });
            }

            const user = await User.findOne({ phone });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Check if OTP is valid
            if (user.otp !== otp) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }

            // Check if OTP has expired
            if (user.otpExpiresAt < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "OTP has expired"
                });
            }

            // Mark OTP as verified
            user.isOtpVerified = true;
            user.otp = null;
            user.otpExpiresAt = null;
            user.status = 'active';
            await user.save();

            // Generate JWT token
            const token = jwt.sign(
                { userId: user._id },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Create user token record
            const userToken = new UserToken({
                userId: user._id,
                token
            });
            await userToken.save();

            // Log activity
            await logActivity({
                actorId: user._id,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'login',
                entityType: 'User',
                entityId: user._id,
                description: `User verified OTP and logged in`,
                adminId: user.adminId
            });

            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                data: {
                    user,
                    token
                }
            });
        } catch (error) {
            console.error("Error in verifyOTP:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all users for admin
    getAdminUsers: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                source,
                campaignId,
                workflowId,
                assignedAgent,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (source) query.source = source;
            if (campaignId) query.campaignId = campaignId;
            if (workflowId) query.workflowId = workflowId;
            if (assignedAgent) query.assignedAgent = assignedAgent;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { email_id: { $regex: search, $options: 'i' } }
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
            const totalCount = await User.countDocuments(query);

            // Execute query with pagination
            const users = await User.find(query)
                .populate('assignedAgent', 'first_name last_name')
                .populate('campaignId', 'name')
                .populate('workflowId', 'name')
                .populate('productId', 'name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get additional stats for each user
            const usersWithStats = await Promise.all(
                users.map(async (user) => {
                    const sessionCount = await UserSession.countDocuments({
                        userId: user._id
                    });

                    const messageCount = await Message.countDocuments({
                        userId: user._id
                    });

                    const orderCount = await Order.countDocuments({
                        userId: user._id
                    });

                    return {
                        ...user.toObject(),
                        stats: {
                            sessionCount,
                            messageCount,
                            orderCount
                        }
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: usersWithStats,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminUsers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get users assigned to an agent
    getAgentUsers: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                status,
                campaignId,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;
    
            // First get all lead assignments for this agent
            const leadAssignments = await LeadAssignment.find({
                agentId,
                status: 'active'
            }).select('userId');
    
            const userIds = leadAssignments.map(assignment => assignment.userId);
    
            // Build query for users
            const query = { _id: { $in: userIds } };
    
            if (status) query.status = status;
            if (campaignId) query.campaignId = campaignId;
    
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { email_id: { $regex: search, $options: 'i' } }
                ];
            }
    
            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.lastActivityAt = -1; // Default to most recently active
            }
    
            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
    
            // Get total count
            const totalCount = await User.countDocuments(query);
    
            // Execute query with pagination
            const users = await User.find(query)
                .populate('campaignId', 'name')
                .populate('workflowId', 'name')
                .populate('productId', 'name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));
    
            // Get additional stats for each user including session details
            const usersWithStats = await Promise.all(
                users.map(async (user) => {
                    // Get the most recent active session
                    const activeSession = await UserSession.findOne({
                        userId: user._id,
                        status: 'active'
                    }).sort({ createdAt: -1 });
    
                    // If no active session, get the most recent completed session
                    const recentSession = activeSession || await UserSession.findOne({
                        userId: user._id
                    }).sort({ createdAt: -1 });
    
                    const unreadMessages = await Message.countDocuments({
                        userId: user._id,
                        sender: 'user',
                        status: { $ne: 'read' }
                    });
    
                    return {
                        ...user.toObject(),
                        currentSession: activeSession,
                        recentSession: recentSession, // Most recent session (active or completed)
                        sessionId: activeSession?._id || recentSession?._id || null, // Session ID for easy access
                        sessionStatus: activeSession?.status || recentSession?.status || null,
                        sessionStartedAt: activeSession?.createdAt || recentSession?.createdAt || null,
                        unreadMessages
                    };
                })
            );
    
            return res.status(200).json({
                success: true,
                data: usersWithStats,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAgentUsers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get user by ID
    getUser: async (req, res) => {
        try {
            const { id } = req.params;
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            const user = await User.findById(id)
                .populate('assignedAgent', 'first_name last_name')
                .populate('campaignId', 'name')
                .populate('workflowId', 'name')
                .populate('productId', 'name');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && user.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this user"
                });
            }

            if (actorRole === 'agent') {
                // Check if agent is assigned to this user
                const assignment = await LeadAssignment.findOne({
                    userId: user._id,
                    agentId: actorId,
                    status: 'active'
                });

                if (!assignment) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to view this user"
                    });
                }
            }

            // Get user statistics
            const sessionCount = await UserSession.countDocuments({
                userId: user._id
            });

            const messageCount = await Message.countDocuments({
                userId: user._id
            });

            const orderCount = await Order.countDocuments({
                userId: user._id
            });

            const paymentCount = await Payment.countDocuments({
                userId: user._id
            });

            // Get verification status
            const verifications = await Verification.find({
                userId: user._id
            }).select('verificationType status createdAt');

            // Get recent sessions
            const recentSessions = await UserSession.find({
                userId: user._id
            })
            .sort({ createdAt: -1 })
            .limit(5);

            // Get recent orders
            const recentOrders = await Order.find({
                userId: user._id
            })
            .sort({ createdAt: -1 })
            .limit(5);

            const userData = {
                ...user.toObject(),
                stats: {
                    sessionCount,
                    messageCount,
                    orderCount,
                    paymentCount
                },
                verifications,
                recentSessions,
                recentOrders
            };

            return res.status(200).json({
                success: true,
                data: userData
            });
        } catch (error) {
            console.error("Error in getUser:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update user
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const {
                name,
                email_id,
                status,
                assignedAgent,
                leadScore,
                notes,
                tags,
                meta,
                communicationPreferences
            } = req.body;

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Check permissions
            if (user.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this user"
                });
            }

            // Update fields
            if (name) user.name = name;
            if (email_id) user.email_id = email_id;
            if (status) user.status = status;
            if (leadScore !== undefined) user.leadScore = leadScore;
            if (notes) user.notes = notes;
            if (tags) user.tags = tags;
            if (meta) user.meta = { ...user.meta, ...meta };
            if (communicationPreferences) {
                user.communicationPreferences = {
                    ...user.communicationPreferences,
                    ...communicationPreferences
                };
            }

            // Handle agent assignment
            if (assignedAgent) {
                // Check if agent exists and belongs to the admin
                const agent = await Agent.findOne({
                    _id: assignedAgent,
                    adminId
                });

                if (!agent) {
                    return res.status(404).json({
                        success: false,
                        message: "Agent not found"
                    });
                }

                // Check if user already has an active assignment
                const existingAssignment = await LeadAssignment.findOne({
                    userId: user._id,
                    status: 'active'
                });

                if (existingAssignment && existingAssignment.agentId.toString() !== assignedAgent) {
                    // Complete the existing assignment
                    existingAssignment.status = 'completed';
                    existingAssignment.completedAt = new Date();
                    await existingAssignment.save();

                    // Create new assignment
                    const newAssignment = new LeadAssignment({
                        userId: user._id,
                        agentId: assignedAgent,
                        adminId,
                        assignedBy: adminId,
                        campaignId: user.campaignId,
                        status: 'active'
                    });
                    await newAssignment.save();
                }

                user.assignedAgent = assignedAgent;
            }

            await user.save();

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'user_updated',
                entityType: 'User',
                entityId: user._id,
                description: `Updated user: ${user.name || user.phone}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "User updated successfully",
                data: user
            });
        } catch (error) {
            console.error("Error in updateUser:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get user analytics
    getUserAnalytics: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate, campaignId, workflowId } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Base query
            const baseQuery = { adminId, ...dateFilter };
            if (campaignId) baseQuery.campaignId = campaignId;
            if (workflowId) baseQuery.workflowId = workflowId;

            // Get total users
            const totalUsers = await User.countDocuments(baseQuery);

            // Get users by status
            const usersByStatus = await User.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get users by source
            const usersBySource = await User.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$source", count: { $sum: 1 } } }
            ]);

            // Get users by campaign
            const usersByCampaign = await User.aggregate([
                { $match: { ...baseQuery, campaignId: { $ne: null } } },
                { $group: { _id: "$campaignId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            // Get campaign details
            const campaignIds = usersByCampaign.map(item => item._id);
            const campaigns = await Campaign.find(
                { _id: { $in: campaignIds } },
                { name: 1 }
            );

            // Map campaign details
            const campaignsWithDetails = usersByCampaign.map(item => {
                const campaign = campaigns.find(c => c._id.toString() === item._id.toString());
                return {
                    campaignId: item._id,
                    count: item.count,
                    name: campaign ? campaign.name : 'Unknown Campaign'
                };
            });

            // Get conversion metrics
            const convertedUsers = usersByStatus.find(item => item._id === 'converted')?.count || 0;
            const conversionRate = totalUsers > 0 ? (convertedUsers / totalUsers) * 100 : 0;

            // Get verification metrics
            const aadhaarVerified = await User.countDocuments({
                ...baseQuery,
                isAadhaarVerified: true
            });

            const panVerified = await User.countDocuments({
                ...baseQuery,
                isPanVerified: true
            });

            // Get daily user registrations
            const dailyRegistrations = await User.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]);

            // Format daily registrations
            const formattedDailyRegistrations = dailyRegistrations.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                count: item.count
            }));

            // Get average lead score
            const avgLeadScore = await User.aggregate([
                { $match: { ...baseQuery, leadScore: { $ne: null } } },
                { $group: { _id: null, avgScore: { $avg: "$leadScore" } } }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    totalUsers,
                    usersByStatus: usersByStatus.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    usersBySource: usersBySource.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    topCampaigns: campaignsWithDetails,
                    conversionRate: parseFloat(conversionRate.toFixed(2)),
                    verificationMetrics: {
                        aadhaarVerified,
                        panVerified,
                        aadhaarVerificationRate: totalUsers > 0 ? parseFloat(((aadhaarVerified / totalUsers) * 100).toFixed(2)) : 0,
                        panVerificationRate: totalUsers > 0 ? parseFloat(((panVerified / totalUsers) * 100).toFixed(2)) : 0
                    },
                    avgLeadScore: avgLeadScore[0]?.avgScore || 0,
                    dailyRegistrations: formattedDailyRegistrations
                }
            });
        } catch (error) {
            console.error("Error in getUserAnalytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update user profile (for users themselves)
    updateProfile: async (req, res) => {
        try {
            const userId = req.userId;
            const { name, email_id, communicationPreferences } = req.body;

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Update allowed fields
            if (name) user.name = name;
            if (email_id) user.email_id = email_id;
            if (communicationPreferences) {
                user.communicationPreferences = {
                    ...user.communicationPreferences,
                    ...communicationPreferences
                };
            }

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                data: user
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

    // Get user profile (for users themselves)
    getProfile: async (req, res) => {
        try {
            const userId = req.userId;

            const user = await User.findById(userId)
                .populate('campaignId', 'name')
                .populate('workflowId', 'name')
                .populate('productId', 'name')
                .populate('assignedAgent', 'first_name last_name');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Get user's verification status
            const verifications = await Verification.find({
                userId: user._id
            }).select('verificationType status completedAt');

            // Get recent orders
            const recentOrders = await Order.find({
                userId: user._id
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('orderNumber status totalAmount createdAt');

            const userData = {
                ...user.toObject(),
                verifications,
                recentOrders
            };

            return res.status(200).json({
                success: true,
                data: userData
            });
        } catch (error) {
            console.error("Error in getProfile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = UserController;