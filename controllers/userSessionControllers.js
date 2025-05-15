// controllers/UserSessionController.js

const {UserSession}= require('../models/UserSessions');
const { User } = require('../models/Users');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { Workflow } = require('../models/Workflows');
const { Campaign } = require('../models/Campaigns');
const { Message } = require('../models/Messages');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

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

const UserSessionController = {
    // Create a new user session
    createSession: async (req, res) => {
        try {
            const {
                userId,
                phone,
                campaignId,
                workflowId,
                adminId,
                agentId,
                currentNodeId,
                source
            } = req.body;

            // Validate required fields
            if (!workflowId) {
                return res.status(400).json({
                    success: false,
                    message: "Workflow ID is required"
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

            let user;
            // Check if user exists by userId or phone, create if not exists
            if (userId) {
                user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found"
                    });
                }
            } else if (phone) {
                user = await User.findOne({ phone });
                if (!user) {
                    // Create new user
                    user = new User({
                        phone,
                        adminId: adminId || workflow.adminId,
                        campaignId,
                        workflowId,
                        status: 'new',
                        source: source || 'whatsapp'
                    });
                    await user.save();
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Either userId or phone is required"
                });
            }

            // Check if admin exists if adminId is provided
            if (adminId) {
                const admin = await Admin.findById(adminId);
                if (!admin) {
                    return res.status(404).json({
                        success: false,
                        message: "Admin not found"
                    });
                }
            }

            // Check if agent exists if agentId is provided
            if (agentId) {
                const agent = await Agent.findById(agentId);
                if (!agent) {
                    return res.status(404).json({
                        success: false,
                        message: "Agent not found"
                    });
                }
            }

            // Check if campaign exists if campaignId is provided
            if (campaignId) {
                const campaign = await Campaign.findById(campaignId);
                if (!campaign) {
                    return res.status(404).json({
                        success: false,
                        message: "Campaign not found"
                    });
                }
            }

            // Create new session
            const userSession = new UserSession({
                userId: user._id,
                phone: user.phone,
                campaignId,
                workflowId,
                adminId: adminId || workflow.adminId,
                agentId,
                currentNodeId: currentNodeId || workflow.startNodeId,
                source: source || 'whatsapp',
                data: req.body.data || {},
                status: 'active'
            });

            await userSession.save();

            // Update user with recent session info
            if (campaignId && !user.campaignId) {
                user.campaignId = campaignId;
            }
            if (workflowId && !user.workflowId) {
                user.workflowId = workflowId;
            }
            if (adminId && !user.adminId) {
                user.adminId = adminId;
            }
            user.lastActivityAt = new Date();
            await user.save();

            // Log activity
            await logActivity({
                actorId: user._id,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'session_started',
                entityType: 'UserSession',
                entityId: userSession._id,
                description: `New user session started for workflow: ${workflow.name}`,
                adminId: adminId || workflow.adminId
            });

            // Create notification for admin or agent if assigned
            const notificationRecipient = agentId 
                ? { forAgent: agentId, forAdmin: adminId || workflow.adminId }
                : { forAdmin: adminId || workflow.adminId };

            await createNotification({
                title: "New User Session Started",
                description: `A new session has started for user ${user.name || user.phone}`,
                type: 'session_started',
                priority: 'medium',
                ...notificationRecipient,
                relatedTo: {
                    model: 'UserSession',
                    id: userSession._id
                },
                actionUrl: `/sessions/${userSession._id}`
            });

            // ADD THIS SECTION - Execute the first workflow node
            // Import the workflow execution function from MessageController
            const { executeWorkflowNode } = require('../services/workflowExecutor');
            await executeWorkflowNode(userSession, workflow.startNodeId);

            return res.status(201).json({
                success: true,
                message: "User session created successfully",
                data: userSession
            });
        } catch (error) {
            console.error("Error in createSession:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all sessions for admin
    getAdminSessions: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                userId,
                campaignId,
                workflowId,
                agentId,
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
            if (userId) query.userId = userId;
            if (campaignId) query.campaignId = campaignId;
            if (workflowId) query.workflowId = workflowId;
            if (agentId) query.agentId = agentId;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                // Search by phone number
                query.phone = { $regex: search, $options: 'i' };
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
            const totalCount = await UserSession.countDocuments(query);

            // Execute query with pagination
            const userSessions = await UserSession.find(query)
                .populate('userId', 'name phone email_id status')
                .populate('workflowId', 'name')
                .populate('campaignId', 'name')
                .populate('agentId', 'first_name last_name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: userSessions,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminSessions:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all sessions for agent
    getAgentSessions: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                status,
                userId,
                campaignId,
                workflowId,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { agentId };

            if (status) query.status = status;
            if (userId) query.userId = userId;
            if (campaignId) query.campaignId = campaignId;
            if (workflowId) query.workflowId = workflowId;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                // Search by phone number
                query.phone = { $regex: search, $options: 'i' };
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
            const totalCount = await UserSession.countDocuments(query);

            // Execute query with pagination
            const userSessions = await UserSession.find(query)
                .populate('userId', 'name phone email_id status')
                .populate('workflowId', 'name')
                .populate('campaignId', 'name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: userSessions,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAgentSessions:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get session by ID
    getSession: async (req, res) => {
        try {
            const { id } = req.params;

            const userSession = await UserSession.findById(id)
                .populate('userId', 'name phone email_id status assignedAgent')
                .populate('workflowId', 'name nodes startNodeId')
                .populate('campaignId', 'name status')
                .populate('agentId', 'first_name last_name email_id')
                .populate('adminId', 'first_name last_name business_name');

            if (!userSession) {
                return res.status(404).json({
                    success: false,
                    message: "User session not found"
                });
            }

            // Check permissions
            if (req.adminId && userSession.adminId && userSession.adminId._id.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to access this session"
                });
            }

            if (req.agentId && userSession.agentId && userSession.agentId._id.toString() !== req.agentId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to access this session"
                });
            }

            // Get messages for this session
            const messages = await Message.find({
                sessionId: userSession._id
            })
            .sort({ createdAt: 1 })
            .limit(100);

            // Get workflow node details if available
            let currentNode = null;
            if (userSession.workflowId && userSession.workflowId.nodes && userSession.currentNodeId) {
                currentNode = userSession.workflowId.nodes.find(
                    node => node.nodeId === userSession.currentNodeId
                );
            }

            // Get previous node details if available
            let previousNode = null;
            if (userSession.workflowId && userSession.workflowId.nodes && userSession.previousNodeId) {
                previousNode = userSession.workflowId.nodes.find(
                    node => node.nodeId === userSession.previousNodeId
                );
            }

            // Calculate session duration
            let sessionDuration = null;
            if (userSession.startedAt) {
                const endTime = userSession.completedAt || new Date();
                sessionDuration = Math.floor((endTime - userSession.startedAt) / 1000); // in seconds
            }

            return res.status(200).json({
                success: true,
                data: {
                    session: userSession,
                    messages,
                    currentNode,
                    previousNode,
                    sessionDuration,
                    sessionData: userSession.data
                }
            });
        } catch (error) {
            console.error("Error in getSession:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update session
    updateSession: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                currentNodeId,
                previousNodeId,
                status,
                data,
                notes
            } = req.body;

            // Determine if admin or agent is making the update
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            const userSession = await UserSession.findById(id);

            if (!userSession) {
                return res.status(404).json({
                    success: false,
                    message: "User session not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && userSession.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this session"
                });
            }

            if (actorRole === 'agent' && (!userSession.agentId || userSession.agentId.toString() !== actorId)) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this session"
                });
            }

            // Build update object
            const updateData = {};

            if (currentNodeId) {
                updateData.currentNodeId = currentNodeId;
                if (userSession.currentNodeId) {
                    updateData.previousNodeId = userSession.currentNodeId;
                }
            }

            if (previousNodeId) {
                updateData.previousNodeId = previousNodeId;
            }

            if (status) {
                // Check if status change is valid
                const validStatusTransitions = {
                    'active': ['paused', 'completed', 'abandoned', 'transferred'],
                    'paused': ['active', 'abandoned'],
                    'completed': [],
                    'abandoned': [],
                    'transferred': []
                };

                if (!validStatusTransitions[userSession.status].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot change status from ${userSession.status} to ${status}`
                    });
                }

                updateData.status = status;

                // Update timestamps based on status change
                if (status === 'completed') {
                    updateData.completedAt = new Date();
                    
                    // Add step to completed steps if not already there
                    if (currentNodeId && !userSession.stepsCompleted.includes(currentNodeId)) {
                        updateData.stepsCompleted = [...userSession.stepsCompleted, currentNodeId];
                    }
                }

                if (status === 'abandoned' || status === 'transferred') {
                    updateData.completedAt = new Date();
                }
            }

            // Update session data if provided
            if (data) {
                updateData.data = {
                    ...userSession.data,
                    ...data
                };
            }

            if (notes) {
                updateData.sessionNotes = notes;
            }

            // Update interaction timestamps
            updateData.lastInteractionAt = new Date();
            updateData.interactionCount = userSession.interactionCount + 1;

            // Apply the update
            const updatedSession = await UserSession.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            );

            // Update user's last activity
            await User.findByIdAndUpdate(
                userSession.userId,
                { $set: { lastActivityAt: new Date() } }
            );

            // Get actor details for logging
            let actorName, actorModel;
            if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
                actorModel = 'Admins';
            } else {
                const agent = await Agent.findById(actorId);
                actorName = agent ? `${agent.first_name} ${agent.last_name}` : null;
                actorModel = 'Agents';
            }

            // Log activity for status changes
            if (status && status !== userSession.status) {
                let action;
                switch (status) {
                    case 'completed':
                        action = 'session_completed';
                        break;
                    case 'abandoned':
                        action = 'session_abandoned';
                        break;
                    case 'paused':
                        action = 'session_paused';
                        break;
                    case 'transferred':
                        action = 'session_transferred';
                        break;
                    default:
                        action = 'session_updated';
                }

                await logActivity({
                    actorId,
                    actorModel,
                    actorName,
                    action,
                    entityType: 'UserSession',
                    entityId: userSession._id,
                    description: `User session status changed from ${userSession.status} to ${status}`,
                    adminId: userSession.adminId
                });
            }

            return res.status(200).json({
                success: true,
                message: "User session updated successfully",
                data: updatedSession
            });
        } catch (error) {
            console.error("Error in updateSession:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Transfer session to another agent
    transferSession: async (req, res) => {
        try {
            const { id } = req.params;
            const { newAgentId, reason } = req.body;

            // Get admin ID from request
            const adminId = req.adminId;

            if (!newAgentId) {
                return res.status(400).json({
                    success: false,
                    message: "New agent ID is required"
                });
            }

            const userSession = await UserSession.findById(id);

            if (!userSession) {
                return res.status(404).json({
                    success: false,
                    message: "User session not found"
                });
            }

            // Check permissions
            if (userSession.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to transfer this session"
                });
            }

            // Check if session is active
            if (userSession.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: "Only active sessions can be transferred"
                });
            }

            // Check if new agent exists and belongs to the admin
            const newAgent = await Agent.findOne({
                _id: newAgentId,
                adminId: userSession.adminId
            });

            if (!newAgent) {
                return res.status(404).json({
                    success: false,
                    message: "New agent not found or doesn't belong to this admin"
                });
            }

            // Record the transfer in history
            const transferRecord = {
                fromAgent: userSession.agentId,
                toAgent: newAgentId,
                reason: reason || "Admin decision",
                transferredAt: new Date()
            };

            // Update the session
            const updatedSession = await UserSession.findByIdAndUpdate(
                id,
                {
                    $set: {
                        agentId: newAgentId,
                        status: 'transferred'
                    },
                    $push: { transferHistory: transferRecord }
                },
                { new: true }
            );

            // Create a new session for the new agent
            const newSession = new UserSession({
                userId: userSession.userId,
                phone: userSession.phone,
                campaignId: userSession.campaignId,
                workflowId: userSession.workflowId,
                adminId: userSession.adminId,
                agentId: newAgentId,
                currentNodeId: userSession.currentNodeId,
                previousNodeId: userSession.previousNodeId,
                data: userSession.data,
                status: 'active',
                source: userSession.source,
                stepsCompleted: userSession.stepsCompleted,
                transferHistory: [...(userSession.transferHistory || []), transferRecord]
            });

            await newSession.save();

            // Update user's assigned agent
            await User.findByIdAndUpdate(
                userSession.userId,
                { assignedAgent: newAgentId }
            );

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'session_transferred',
                entityType: 'UserSession',
                entityId: newSession._id,
                description: `User session transferred to agent ${newAgentId}`,
                adminId: userSession.adminId
            });

            // Create notifications for both agents
            if (userSession.agentId) {
                await createNotification({
                    title: "Session Transferred Away",
                    description: `A session has been transferred to another agent`,
                    type: 'session_transferred',
                    priority: 'medium',
                    forAgent: userSession.agentId,
                    forAdmin: userSession.adminId,
                    relatedTo: {
                        model: 'UserSession',
                        id: userSession._id
                    }
                });
            }

            await createNotification({
                title: "New Session Transferred To You",
                description: `A session has been transferred to you`,
                type: 'session_started',
                priority: 'high',
                forAgent: newAgentId,
                forAdmin: userSession.adminId,
                relatedTo: {
                    model: 'UserSession',
                    id: newSession._id
                },
                actionUrl: `/sessions/${newSession._id}`
            });

            return res.status(200).json({
                success: true,
                message: "Session transferred successfully",
                data: {
                    oldSession: updatedSession,
                    newSession
                }
            });
        } catch (error) {
            console.error("Error in transferSession:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get session statistics
    getSessionStats: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate, campaignId, workflowId } = req.query;

            // Build date range filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Build base query
            const baseQuery = { adminId, ...dateFilter };
            if (campaignId) baseQuery.campaignId = campaignId;
            if (workflowId) baseQuery.workflowId = workflowId;

            // Get total sessions
            const totalSessions = await UserSession.countDocuments(baseQuery);

            // Get sessions by status
            const statusStats = await UserSession.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Calculate completion rate
            const completedCount = statusStats.find(item => item._id === 'completed')?.count || 0;
            const completionRate = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;

            // Get average session duration for completed sessions
            const completedSessions = await UserSession.find({
                ...baseQuery,
                status: 'completed',
                startedAt: { $ne: null },
                completedAt: { $ne: null }
            });

            let totalDuration = 0;
            completedSessions.forEach(session => {
                const durationMs = session.completedAt.getTime() - session.startedAt.getTime();
                totalDuration += durationMs;
            });

            const avgSessionDuration = completedSessions.length > 0 
                ? Math.floor(totalDuration / completedSessions.length / 1000) // in seconds
                : 0;

            // Get sessions by source
            const sourceStats = await UserSession.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$source", count: { $sum: 1 } } }
            ]);

            // Get sessions by campaign
            const campaignStats = await UserSession.aggregate([
                { $match: { ...baseQuery, campaignId: { $ne: null } } },
                { $group: { _id: "$campaignId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            // Get campaign details
            const campaignIds = campaignStats.map(item => item._id);
            const campaigns = await Campaign.find(
                { _id: { $in: campaignIds } },
                { name: 1 }
            );

            // Map campaign details to stats
            const campaignDetails = campaignStats.map(item => {
                const campaign = campaigns.find(c => c._id.toString() === item._id.toString());
                return {
                    campaignId: item._id,
                    count: item.count,
                    name: campaign ? campaign.name : 'Unknown Campaign'
                };
            });

            // Get sessions by workflow
            const workflowStats = await UserSession.aggregate([
                { $match: { ...baseQuery, workflowId: { $ne: null } } },
                { $group: { _id: "$workflowId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            // Get workflow details
            const workflowIds = workflowStats.map(item => item._id);
            const workflows = await Workflow.find(
                { _id: { $in: workflowIds } },
                { name: 1 }
            );

            // Map workflow details to stats
            const workflowDetails = workflowStats.map(item => {
                const workflow = workflows.find(w => w._id.toString() === item._id.toString());
                return {
                    workflowId: item._id,
                    count: item.count,
                    name: workflow ? workflow.name : 'Unknown Workflow'
                };
            });

            // Get sessions by day
            const dailyStats = await UserSession.aggregate([
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

            // Format daily stats
            const formattedDailyStats = dailyStats.map(item => {
                const date = new Date(
                    item._id.year,
                    item._id.month - 1,
                    item._id.day
                );
                return {
                    date: date.toISOString().split('T')[0], // YYYY-MM-DD format
                    count: item.count
                };
            });

            return res.status(200).json({
                success: true,
                data: {
                    totalSessions,
                    statusBreakdown: statusStats.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    avgSessionDurationSeconds: avgSessionDuration,
                    sourceBreakdown: sourceStats.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    topCampaigns: campaignDetails,
                    topWorkflows: workflowDetails,
                    dailyStats: formattedDailyStats
                }
            });
        } catch (error) {
            console.error("Error in getSessionStats:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = UserSessionController; 