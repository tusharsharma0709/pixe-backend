// controllers/AgentController.js
const { Agent } = require('../models/Agents');
const { Admin } = require('../models/Admins');
const { AgentToken } = require('../models/AgentTokens');
const { LeadAssignment } = require('../models/LeadAssignments');
const { UserSession } = require('../models/UserSessions');
const { Message } = require('../models/Messages');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
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

const AgentController = {
    // Register a new agent
    registerAgent: async (req, res) => {
        try {
            const {
                first_name,
                last_name,
                mobile,
                email_id,
                password,
                role,
                profile_image,
                leadCapacity,
                specialization
            } = req.body;

            const adminId = req.adminId;

            // Validate required fields
            if (!first_name || !last_name || !mobile || !email_id || !password) {
                return res.status(400).json({
                    success: false,
                    message: "All required fields must be provided"
                });
            }

            // Check if admin exists
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Check if agent email already exists
            const existingAgent = await Agent.findOne({ email_id });
            if (existingAgent) {
                return res.status(400).json({
                    success: false,
                    message: "Agent with this email already exists"
                });
            }

            // Check if mobile already exists
            const existingMobile = await Agent.findOne({ mobile });
            if (existingMobile) {
                return res.status(400).json({
                    success: false,
                    message: "Agent with this mobile number already exists"
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new agent
            const agent = new Agent({
                first_name,
                last_name,
                mobile,
                email_id,
                password: hashedPassword,
                adminId,
                role: role || 'customer_support',
                profile_image,
                leadCapacity: leadCapacity || 20,
                specialization: specialization || [],
                status: true
            });

            await agent.save();

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'agent_created',
                entityType: 'Agent',
                entityId: agent._id,
                description: `Created agent: ${agent.first_name} ${agent.last_name}`,
                adminId
            });

            // Create notification for the agent
            await createNotification({
                title: "Welcome to the Team",
                description: `Your agent account has been created successfully`,
                type: 'system',
                priority: 'medium',
                forAgent: agent._id,
                forAdmin: adminId
            });

            // Remove password from response
            const agentResponse = agent.toObject();
            delete agentResponse.password;

            return res.status(201).json({
                success: true,
                message: "Agent registered successfully",
                data: agentResponse
            });
        } catch (error) {
            console.error("Error in registerAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Agent login
    loginAgent: async (req, res) => {
        try {
            const { email_id, password, deviceToken, deviceInfo, ipAddress } = req.body;

            // Validate required fields
            if (!email_id || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }

            // Find agent
            const agent = await Agent.findOne({ email_id });
            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Check if agent is active
            if (!agent.status) {
                return res.status(403).json({
                    success: false,
                    message: "Your account has been deactivated. Please contact your admin."
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, agent.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { agentId: agent._id, adminId: agent.adminId },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Create agent token record
            const agentToken = new AgentToken({
                agentId: agent._id,
                token,
                tokenType: 'login',
                deviceInfo,
                ipAddress,
                lastUsed: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });

            await agentToken.save();

            // Update agent's online status and device token
            agent.isOnline = true;
            agent.lastActive = new Date();
            if (deviceToken) {
                agent.deviceToken = deviceToken;
            }
            await agent.save();

            // Log activity
            await logActivity({
                actorId: agent._id,
                actorModel: 'Agents',
                actorName: `${agent.first_name} ${agent.last_name}`,
                action: 'login',
                entityType: 'Agent',
                entityId: agent._id,
                description: `Agent logged in`,
                adminId: agent.adminId,
                ip: ipAddress,
                deviceInfo
            });

            // Remove password from response
            const agentResponse = agent.toObject();
            delete agentResponse.password;

            return res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    agent: agentResponse,
                    token
                }
            });
        } catch (error) {
            console.error("Error in loginAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Agent logout
    logoutAgent: async (req, res) => {
        try {
            const agentId = req.agentId;
            const token = req.headers.authorization?.split(' ')[1];

            // Revoke the current token
            await AgentToken.findOneAndUpdate(
                { token, agentId },
                { 
                    isRevoked: true,
                    revokedAt: new Date()
                }
            );

            // Update agent's online status
            const agent = await Agent.findByIdAndUpdate(
                agentId,
                { 
                    isOnline: false,
                    lastActive: new Date()
                },
                { new: true }
            );

            // Log activity
            await logActivity({
                actorId: agentId,
                actorModel: 'Agents',
                actorName: `${agent.first_name} ${agent.last_name}`,
                action: 'logout',
                entityType: 'Agent',
                entityId: agentId,
                description: `Agent logged out`,
                adminId: agent.adminId
            });

            return res.status(200).json({
                success: true,
                message: "Logged out successfully"
            });
        } catch (error) {
            console.error("Error in logoutAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all agents for admin
    getAdminAgents: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                role,
                isOnline,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (typeof status === 'boolean') query.status = status;
            if (role) query.role = role;
            if (typeof isOnline === 'boolean') query.isOnline = isOnline;

            if (search) {
                query.$or = [
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { email_id: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } }
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
            const totalCount = await Agent.countDocuments(query);

            // Execute query with pagination
            const agents = await Agent.find(query)
                .select('-password')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get additional stats for each agent
            const agentsWithStats = await Promise.all(
                agents.map(async (agent) => {
                    const activeLeads = await LeadAssignment.countDocuments({
                        agentId: agent._id,
                        status: 'active'
                    });

                    const completedLeads = await LeadAssignment.countDocuments({
                        agentId: agent._id,
                        status: 'completed'
                    });

                    return {
                        ...agent.toObject(),
                        stats: {
                            activeLeads,
                            completedLeads,
                            availableCapacity: agent.leadCapacity - agent.currentLeadCount
                        }
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: agentsWithStats,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminAgents:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get agent by ID
    getAgent: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const agent = await Agent.findOne({ _id: id, adminId })
                .select('-password');

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Get agent statistics
            const activeLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'active'
            });

            const completedLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'completed'
            });

            const totalMessages = await Message.countDocuments({
                agentId: agent._id
            });

            const activeSessions = await UserSession.countDocuments({
                agentId: agent._id,
                status: 'active'
            });

            const agentData = {
                ...agent.toObject(),
                stats: {
                    activeLeads,
                    completedLeads,
                    totalMessages,
                    activeSessions,
                    availableCapacity: agent.leadCapacity - agent.currentLeadCount
                }
            };

            return res.status(200).json({
                success: true,
                data: agentData
            });
        } catch (error) {
            console.error("Error in getAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update agent
    updateAgent: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const {
                first_name,
                last_name,
                mobile,
                email_id,
                role,
                profile_image,
                status,
                leadCapacity,
                specialization
            } = req.body;

            const agent = await Agent.findOne({ _id: id, adminId });

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Check if email is being changed to an existing one
            if (email_id && email_id !== agent.email_id) {
                const existingAgent = await Agent.findOne({ 
                    email_id, 
                    _id: { $ne: agent._id } 
                });

                if (existingAgent) {
                    return res.status(400).json({
                        success: false,
                        message: "Email already in use by another agent"
                    });
                }
            }

            // Check if mobile is being changed to an existing one
            if (mobile && mobile !== agent.mobile) {
                const existingMobile = await Agent.findOne({ 
                    mobile, 
                    _id: { $ne: agent._id } 
                });

                if (existingMobile) {
                    return res.status(400).json({
                        success: false,
                        message: "Mobile number already in use by another agent"
                    });
                }
            }

            // Update agent fields
            if (first_name) agent.first_name = first_name;
            if (last_name) agent.last_name = last_name;
            if (mobile) agent.mobile = mobile;
            if (email_id) agent.email_id = email_id;
            if (role) agent.role = role;
            if (profile_image !== undefined) agent.profile_image = profile_image;
            if (typeof status === 'boolean') agent.status = status;
            if (leadCapacity) agent.leadCapacity = leadCapacity;
            if (specialization) agent.specialization = specialization;

            await agent.save();

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'agent_updated',
                entityType: 'Agent',
                entityId: agent._id,
                description: `Updated agent: ${agent.first_name} ${agent.last_name}`,
                adminId
            });

            // If status is being deactivated, revoke all tokens
            if (status === false) {
                await AgentToken.updateMany(
                    { agentId: agent._id, isRevoked: false },
                    { 
                        isRevoked: true,
                        revokedAt: new Date(),
                        revokedBy: adminId
                    }
                );

                // Update agent's online status
                agent.isOnline = false;
                await agent.save();
            }

            // Remove password from response
            const agentResponse = agent.toObject();
            delete agentResponse.password;

            return res.status(200).json({
                success: true,
                message: "Agent updated successfully",
                data: agentResponse
            });
        } catch (error) {
            console.error("Error in updateAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete agent
    deleteAgent: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const agent = await Agent.findOne({ _id: id, adminId });

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Check if agent has active leads
            const activeLeadCount = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'active'
            });

            if (activeLeadCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete agent with ${activeLeadCount} active leads. Please reassign them first.`
                });
            }

            // Revoke all tokens
            await AgentToken.updateMany(
                { agentId: agent._id },
                { 
                    isRevoked: true,
                    revokedAt: new Date(),
                    revokedBy: adminId
                }
            );

            // Delete agent
            await Agent.findByIdAndDelete(id);

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'agent_deleted',
                entityType: 'Agent',
                entityId: agent._id,
                description: `Deleted agent: ${agent.first_name} ${agent.last_name}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "Agent deleted successfully"
            });
        } catch (error) {
            console.error("Error in deleteAgent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Change agent password
    changePassword: async (req, res) => {
        try {
            const agentId = req.agentId;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }

            const agent = await Agent.findById(agentId);

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, agent.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            agent.password = hashedPassword;
            await agent.save();

            // Revoke all existing tokens except the current one
            const currentToken = req.headers.authorization?.split(' ')[1];
            await AgentToken.updateMany(
                { 
                    agentId: agent._id,
                    token: { $ne: currentToken },
                    isRevoked: false
                },
                { 
                    isRevoked: true,
                    revokedAt: new Date()
                }
            );

            // Log activity
            await logActivity({
                actorId: agentId,
                actorModel: 'Agents',
                actorName: `${agent.first_name} ${agent.last_name}`,
                action: 'password_change',
                entityType: 'Agent',
                entityId: agentId,
                description: `Agent changed password`,
                adminId: agent.adminId
            });

            return res.status(200).json({
                success: true,
                message: "Password changed successfully"
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

    // Get agent profile (for agent themselves)
    getProfile: async (req, res) => {
        try {
            const agentId = req.agentId;

            const agent = await Agent.findById(agentId)
                .select('-password');

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Get agent statistics
            const activeLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'active'
            });

            const completedLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'completed'
            });

            const todayMessages = await Message.countDocuments({
                agentId: agent._id,
                createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
            });

            const agentData = {
                ...agent.toObject(),
                stats: {
                    activeLeads,
                    completedLeads,
                    todayMessages,
                    availableCapacity: agent.leadCapacity - agent.currentLeadCount
                }
            };

            return res.status(200).json({
                success: true,
                data: agentData
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

    // Update agent profile (for agent themselves)
    updateProfile: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                first_name,
                last_name,
                mobile,
                profile_image,
                specialization
            } = req.body;

            const agent = await Agent.findById(agentId);

            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Check if mobile is being changed to an existing one
            if (mobile && mobile !== agent.mobile) {
                const existingMobile = await Agent.findOne({ 
                    mobile, 
                    _id: { $ne: agent._id } 
                });

                if (existingMobile) {
                    return res.status(400).json({
                        success: false,
                        message: "Mobile number already in use"
                    });
                }
            }

            // Update allowed fields
            if (first_name) agent.first_name = first_name;
            if (last_name) agent.last_name = last_name;
            if (mobile) agent.mobile = mobile;
            if (profile_image !== undefined) agent.profile_image = profile_image;
            if (specialization) agent.specialization = specialization;

            await agent.save();

            // Remove password from response
            const agentResponse = agent.toObject();
            delete agentResponse.password;

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                data: agentResponse
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

    // Get agent performance
    getAgentPerformance: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;
            const { startDate, endDate } = req.query;

            // Check if agent belongs to admin
            const agent = await Agent.findOne({ _id: id, adminId });
            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found"
                });
            }

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Get lead statistics
            const totalLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                ...dateFilter
            });

            const completedLeads = await LeadAssignment.countDocuments({
                agentId: agent._id,
                status: 'completed',
                ...dateFilter
            });

            const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;

            // Get average response time
            const messages = await Message.find({
                agentId: agent._id,
                sender: 'agent',
                ...dateFilter
            });

            let totalResponseTime = 0;
            let responseCount = 0;

            for (const message of messages) {
                // Find the previous user message in the same session
                const previousUserMessage = await Message.findOne({
                    sessionId: message.sessionId,
                    sender: 'user',
                    createdAt: { $lt: message.createdAt }
                }).sort({ createdAt: -1 });

                if (previousUserMessage) {
                    const responseTime = message.createdAt - previousUserMessage.createdAt;
                    totalResponseTime += responseTime;
                    responseCount++;
                }
            }

            const avgResponseTime = responseCount > 0 
                ? Math.floor(totalResponseTime / responseCount / 60000) // in minutes
                : 0;

            // Get session statistics
            const totalSessions = await UserSession.countDocuments({
                agentId: agent._id,
                ...dateFilter
            });

            const completedSessions = await UserSession.countDocuments({
                agentId: agent._id,
                status: 'completed',
                ...dateFilter
            });

            // Get message statistics
            const totalMessages = await Message.countDocuments({
                agentId: agent._id,
                ...dateFilter
            });

            // Get daily activity
            const dailyActivity = await Message.aggregate([
                {
                    $match: {
                        agentId: agent._id,
                        ...dateFilter
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" }
                        },
                        messageCount: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]);

            const formattedDailyActivity = dailyActivity.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                messageCount: item.messageCount
            }));

            return res.status(200).json({
                success: true,
                data: {
                    agent: {
                        id: agent._id,
                        name: `${agent.first_name} ${agent.last_name}`,
                        email: agent.email_id,
                        role: agent.role
                    },
                    performance: {
                        totalLeads,
                        completedLeads,
                        conversionRate: parseFloat(conversionRate.toFixed(2)),
                        avgResponseTimeMinutes: avgResponseTime,
                        totalSessions,
                        completedSessions,
                        totalMessages,
                        customerRating: agent.performance.customerRating,
                        dailyActivity: formattedDailyActivity
                    }
                }
            });
        } catch (error) {
            console.error("Error in getAgentPerformance:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = AgentController;