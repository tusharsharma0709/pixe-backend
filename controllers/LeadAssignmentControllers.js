// controllers/LeadAssignmentController.js
const { LeadAssignment } = require('../models/LeadAssignments');
const { Agent } = require('../models/Agents');
const { User } = require('../models/Users');
const { Admin } = require('../models/Admins');
const { Campaign } = require('../models/Campaigns');
const { ActivityLog } = require('../models/ActivityLogs');
const { Message } = require('../models/Messages');
const { Notification } = require('../models/Notifications');
const mongoose = require('mongoose');
const { UserSession } = require('../models/UserSessions');
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

const LeadAssignmentController = {
    // Create a new lead assignment
    createAssignment: async (req, res) => {
        try {
            const { userId, agentId, campaignId, priority, notes } = req.body;
            const adminId = req.adminId; // Get adminId from authenticated request

            // Validate required fields
            if (!userId || !agentId) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields"
                });
            }

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Check if agent exists and belongs to the admin
            const agent = await Agent.findOne({ _id: agentId, adminId });
            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: "Agent not found or doesn't belong to this admin"
                });
            }

            // Check agent's lead capacity
            if (agent.currentLeadCount >= agent.leadCapacity) {
                return res.status(400).json({
                    success: false,
                    message: "Agent has reached maximum lead capacity"
                });
            }

            // Check if the lead is already assigned to an agent
            const existingAssignment = await LeadAssignment.findOne({
                userId,
                adminId,
                status: 'active'
            });

            if (existingAssignment) {
                return res.status(400).json({
                    success: false,
                    message: "User is already assigned to an agent",
                    data: existingAssignment
                });
            }

            // Create new lead assignment
            const leadAssignment = new LeadAssignment({
                userId,
                agentId,
                adminId,
                campaignId,
                assignedBy: adminId,
                priority: priority || 'medium',
                notes,
                initialUserStatus: user.status || 'new',
                isAutoAssigned: req.body.isAutoAssigned || false
            });

            await leadAssignment.save();

            // Update agent's lead count
            await Agent.findByIdAndUpdate(agentId, {
                $inc: { currentLeadCount: 1 }
            });

            // Update user's assigned agent
            await User.findByIdAndUpdate(userId, {
                assignedAgent: agentId
            });

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'lead_assigned',
                entityType: 'LeadAssignment',
                entityId: leadAssignment._id,
                description: `Lead assigned: User ${user.name || user.phone} to Agent ${agent.first_name} ${agent.last_name}`,
                adminId
            });

            // Create notification for agent
            await createNotification({
                title: "New Lead Assigned",
                description: `A new lead (${user.name || user.phone}) has been assigned to you`,
                type: 'lead_assigned',
                priority: priority || 'medium',
                forAgent: agentId,
                forAdmin: adminId,
                relatedTo: {
                    model: 'User',
                    id: userId
                },
                actionUrl: `/leads/${leadAssignment._id}`
            });

            return res.status(201).json({
                success: true,
                message: "Lead assigned successfully",
                data: leadAssignment
            });
        } catch (error) {
            console.error("Error in createAssignment:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all lead assignments for an admin
    getAdminAssignments: async (req, res) => {
        try {
            const adminId = req.adminId; // Get from auth middleware
            const { status, agentId, priority, campaignId, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (agentId) query.agentId = agentId;
            if (priority) query.priority = priority;
            if (campaignId) query.campaignId = campaignId;

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
            const totalCount = await LeadAssignment.countDocuments(query);

            // Execute query with pagination
            const leadAssignments = await LeadAssignment.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name phone email_id status')
                .populate('agentId', 'first_name last_name email_id')
                .populate('campaignId', 'name status');

            return res.status(200).json({
                success: true,
                data: leadAssignments,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminAssignments:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all lead assignments for an agent
    getAgentAssignments: async (req, res) => {
        try {
            const agentId = req.agentId; // Get from auth middleware
            const { status, priority, sortBy, sortOrder, page = 1, limit = 10 } = req.query;
    
            // Build query
            const query = { agentId };
    
            if (status) query.status = status;
            if (priority) query.priority = priority;
    
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
            const totalCount = await LeadAssignment.countDocuments(query);
    
            // Execute query with pagination
            const leadAssignments = await LeadAssignment.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name phone email_id status')
                .populate('campaignId', 'name status');
    
            // Enhanced with session details for each assignment
            const assignmentsWithSessionDetails = await Promise.all(
                leadAssignments.map(async (assignment) => {
                    if (!assignment.userId) {
                        return assignment.toObject();
                    }
    
                    // Get the most recent active session for this user
                    const activeSession = await UserSession.findOne({
                        userId: assignment.userId._id,
                        status: 'active'
                    }).sort({ createdAt: -1 });
    
                    // If no active session, get the most recent session of any status
                    const recentSession = activeSession || await UserSession.findOne({
                        userId: assignment.userId._id
                    }).sort({ createdAt: -1 });
    
                    // Get unread messages count for this user
                    const unreadMessages = await Message.countDocuments({
                        userId: assignment.userId._id,
                        sender: 'user',
                        status: { $ne: 'read' }
                    });
    
                    // Get total sessions count for this user
                    const totalSessions = await UserSession.countDocuments({
                        userId: assignment.userId._id
                    });
    
                    // Get completed sessions count
                    const completedSessions = await UserSession.countDocuments({
                        userId: assignment.userId._id,
                        status: 'completed'
                    });
    
                    return {
                        ...assignment.toObject(),
                        sessionDetails: {
                            // Current active session
                            currentSession: activeSession,
                            
                            // Most recent session (active or completed)
                            recentSession: recentSession,
                            
                            // Direct access fields
                            sessionId: activeSession?._id || recentSession?._id || null,
                            sessionStatus: activeSession?.status || recentSession?.status || null,
                            sessionStartedAt: activeSession?.createdAt || recentSession?.createdAt || null,
                            sessionEndedAt: recentSession?.endedAt || null,
                            
                            // Session statistics
                            totalSessions: totalSessions,
                            completedSessions: completedSessions,
                            hasActiveSession: !!activeSession,
                            
                            // Communication stats
                            unreadMessages: unreadMessages,
                            
                            // Last activity timestamp
                            lastActivityAt: recentSession?.updatedAt || assignment.userId.lastActivityAt || null
                        }
                    };
                })
            );
    
            return res.status(200).json({
                success: true,
                data: assignmentsWithSessionDetails,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAgentAssignments:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get a specific lead assignment
    getAssignment: async (req, res) => {
        try {
            const { id } = req.params;

            const leadAssignment = await LeadAssignment.findById(id)
                .populate('userId', 'name phone email_id status')
                .populate('agentId', 'first_name last_name email_id')
                .populate('adminId', 'first_name last_name business_name')
                .populate('campaignId', 'name status')
                .populate('assignedBy', 'first_name last_name');

            if (!leadAssignment) {
                return res.status(404).json({
                    success: false,
                    message: "Lead assignment not found"
                });
            }

            // Ensure the requester has access to this assignment
            if (req.adminId) {
                // Admin can access any assignment under their account
                if (leadAssignment.adminId.toString() !== req.adminId) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to access this assignment"
                    });
                }
            } else if (req.agentId) {
                // Agent can only access their own assignments
                if (leadAssignment.agentId.toString() !== req.agentId) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to access this assignment"
                    });
                }
            }

            // Get recent messages between user and agent
            const recentMessages = await Message.find({
                $or: [
                    { userId: leadAssignment.userId, agentId: leadAssignment.agentId },
                    { userId: leadAssignment.userId, sender: 'workflow' }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(20);

            return res.status(200).json({
                success: true,
                data: {
                    assignment: leadAssignment,
                    recentMessages
                }
            });
        } catch (error) {
            console.error("Error in getAssignment:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Transfer a lead to another agent
    transferLead: async (req, res) => {
        try {
            const { id } = req.params;
            const { newAgentId, transferReason } = req.body;
            const transferredBy = req.adminId; // Get from auth middleware

            if (!newAgentId) {
                return res.status(400).json({
                    success: false,
                    message: "New agent ID is required"
                });
            }

            // Find the current assignment
            const currentAssignment = await LeadAssignment.findById(id);
            if (!currentAssignment) {
                return res.status(404).json({
                    success: false,
                    message: "Lead assignment not found"
                });
            }

            // Check if admin has permission
            if (currentAssignment.adminId.toString() !== transferredBy) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to transfer this lead"
                });
            }

            if (currentAssignment.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: "Only active assignments can be transferred"
                });
            }

            // Ensure new agent exists and belongs to the same admin
            const newAgent = await Agent.findOne({ 
                _id: newAgentId, 
                adminId: currentAssignment.adminId 
            });

            if (!newAgent) {
                return res.status(404).json({
                    success: false,
                    message: "New agent not found or doesn't belong to this admin"
                });
            }

            // Check new agent's lead capacity
            if (newAgent.currentLeadCount >= newAgent.leadCapacity) {
                return res.status(400).json({
                    success: false,
                    message: "New agent has reached maximum lead capacity"
                });
            }

            // Update the transfer history
            const transferRecord = {
                fromAgent: currentAssignment.agentId,
                toAgent: newAgentId,
                transferReason: transferReason || 'Admin decision',
                transferredAt: new Date(),
                transferredBy: transferredBy
            };

            // Create a new lead assignment for the new agent
            const newAssignment = new LeadAssignment({
                userId: currentAssignment.userId,
                agentId: newAgentId,
                adminId: currentAssignment.adminId,
                campaignId: currentAssignment.campaignId,
                assignedBy: transferredBy,
                priority: currentAssignment.priority,
                notes: `Transferred from agent ${currentAssignment.agentId}. Reason: ${transferReason || 'Admin decision'}`,
                initialUserStatus: currentAssignment.initialUserStatus,
                transferHistory: [...(currentAssignment.transferHistory || []), transferRecord]
            });

            await newAssignment.save();

            // Mark the old assignment as transferred
            currentAssignment.status = 'transferred';
            currentAssignment.completedAt = new Date();
            currentAssignment.completionReason = 'transferred';
            currentAssignment.userStatusAtCompletion = await User.findById(currentAssignment.userId).then(user => user.status);
            await currentAssignment.save();

            // Update agent lead counts
            await Agent.findByIdAndUpdate(currentAssignment.agentId, {
                $inc: { currentLeadCount: -1 }
            });

            await Agent.findByIdAndUpdate(newAgentId, {
                $inc: { currentLeadCount: 1 }
            });

            // Update user's assigned agent
            await User.findByIdAndUpdate(currentAssignment.userId, {
                assignedAgent: newAgentId
            });

            // Log activity
            const admin = await Admin.findById(transferredBy);
            await logActivity({
                actorId: transferredBy,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'lead_transferred',
                entityType: 'LeadAssignment',
                entityId: newAssignment._id,
                description: `Lead transferred from agent ${currentAssignment.agentId} to agent ${newAgentId}`,
                adminId: currentAssignment.adminId
            });

            // Create notifications for both agents
            await createNotification({
                title: "Lead Transferred Away",
                description: `A lead has been transferred to another agent`,
                type: 'lead_update',
                forAgent: currentAssignment.agentId,
                forAdmin: currentAssignment.adminId,
                relatedTo: {
                    model: 'User',
                    id: currentAssignment.userId
                }
            });

            await createNotification({
                title: "New Lead Transferred To You",
                description: `A lead has been transferred to you from another agent`,
                type: 'lead_assigned',
                forAgent: newAgentId,
                forAdmin: currentAssignment.adminId,
                relatedTo: {
                    model: 'User',
                    id: currentAssignment.userId
                },
                actionUrl: `/leads/${newAssignment._id}`
            });

            return res.status(200).json({
                success: true,
                message: "Lead transferred successfully",
                data: {
                    oldAssignment: currentAssignment,
                    newAssignment: newAssignment
                }
            });
        } catch (error) {
            console.error("Error in transferLead:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update lead assignment status
    updateAssignmentStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, completionReason, notes } = req.body;
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: "Status is required"
                });
            }

            const assignment = await LeadAssignment.findById(id);
            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: "Lead assignment not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin') {
                if (assignment.adminId.toString() !== actorId) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to update this assignment"
                    });
                }
            } else { // agent
                if (assignment.agentId.toString() !== actorId) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to update this assignment"
                    });
                }
                
                // Agents can only mark as completed, not other statuses
                if (status !== 'completed') {
                    return res.status(403).json({
                        success: false,
                        message: "Agents can only mark assignments as completed"
                    });
                }
            }

            // Check if status change is valid
            const validStatusTransitions = {
                'active': ['completed', 'transferred', 'inactive'],
                'completed': [],
                'transferred': [],
                'inactive': ['active']
            };

            if (!validStatusTransitions[assignment.status].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot change status from ${assignment.status} to ${status}`
                });
            }

            // Update assignment
            assignment.status = status;
            
            if (notes) {
                assignment.notes = notes;
            }

            // If completing the assignment
            if (status === 'completed') {
                assignment.completedAt = new Date();
                assignment.completionReason = completionReason || 'admin_decision';
                
                // Get current user status and store it
                const user = await User.findById(assignment.userId);
                if (user) {
                    assignment.userStatusAtCompletion = user.status;
                }

                // Update agent lead count
                await Agent.findByIdAndUpdate(assignment.agentId, {
                    $inc: { currentLeadCount: -1 }
                });
            }

            // If marking as inactive
            if (status === 'inactive') {
                // Update agent lead count
                await Agent.findByIdAndUpdate(assignment.agentId, {
                    $inc: { currentLeadCount: -1 }
                });
            }

            // If reactivating
            if (assignment.status === 'inactive' && status === 'active') {
                // Update agent lead count
                await Agent.findByIdAndUpdate(assignment.agentId, {
                    $inc: { currentLeadCount: 1 }
                });
            }

            await assignment.save();

            // Log activity
            let actorName = null;
            if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
            } else {
                const agent = await Agent.findById(actorId);
                actorName = agent ? `${agent.first_name} ${agent.last_name}` : null;
            }
            
            await logActivity({
                actorId,
                actorModel: actorRole === 'admin' ? 'Admins' : 'Agents',
                actorName,
                action: 'lead_status_changed',
                entityType: 'LeadAssignment',
                entityId: assignment._id,
                description: `Lead assignment status changed from ${assignment.status} to ${status}`,
                adminId: assignment.adminId
            });

            // Create notification
            const notificationTarget = actorRole === 'admin' ? { forAgent: assignment.agentId } : { forAdmin: assignment.adminId };
            
            await createNotification({
                title: "Lead Assignment Updated",
                description: `The status of a lead assignment has been changed to ${status}`,
                type: 'lead_update',
                ...notificationTarget,
                relatedTo: {
                    model: 'LeadAssignment',
                    id: assignment._id
                }
            });

            return res.status(200).json({
                success: true,
                message: "Lead assignment status updated successfully",
                data: assignment
            });
        } catch (error) {
            console.error("Error in updateAssignmentStatus:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get lead assignments analytics for an admin
    getAdminLeadAnalytics: async (req, res) => {
        try {
            const adminId = req.adminId; // Get from auth middleware
            const { startDate, endDate } = req.query;

            // Create date range filters
            const dateFilter = {};
            if (startDate) {
                dateFilter.createdAt = { $gte: new Date(startDate) };
            }
            if (endDate) {
                if (!dateFilter.createdAt) dateFilter.createdAt = {};
                dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Base query
            const baseQuery = { adminId, ...dateFilter };

            // Get total lead assignments
            const totalAssignments = await LeadAssignment.countDocuments(baseQuery);

            // Get assignments by status
            const statusCounts = await LeadAssignment.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get assignments by completion reason
            const completionReasonCounts = await LeadAssignment.aggregate([
                { $match: { ...baseQuery, completionReason: { $ne: null } } },
                { $group: { _id: "$completionReason", count: { $sum: 1 } } }
            ]);

            // Get assignments by agent
            const agentCounts = await LeadAssignment.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$agentId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // Get agent details for the ids
            const agentIds = agentCounts.map(item => item._id);
            const agents = await Agent.find(
                { _id: { $in: agentIds } },
                { first_name: 1, last_name: 1, email_id: 1 }
            );

            // Map agent details to counts
            const agentsWithDetails = agentCounts.map(item => {
                const agent = agents.find(a => a._id.toString() === item._id.toString());
                return {
                    agentId: item._id,
                    count: item.count,
                    name: agent ? `${agent.first_name} ${agent.last_name}` : 'Unknown',
                    email: agent ? agent.email_id : null
                };
            });

            // Get conversion rate
            const convertedCount = statusCounts.find(item => item._id === 'completed')?.count || 0;
            const conversionRate = totalAssignments > 0 ? (convertedCount / totalAssignments) * 100 : 0;

            // Get average time to completion
            const completedAssignments = await LeadAssignment.find({
                ...baseQuery,
                status: 'completed',
                startedAt: { $ne: null },
                completedAt: { $ne: null }
            });

            let totalCompletionTime = 0;
            completedAssignments.forEach(assignment => {
                const completionTime = 
                    (assignment.completedAt.getTime() - assignment.startedAt.getTime()) / (1000 * 60 * 60); // in hours
                totalCompletionTime += completionTime;
            });

            const avgCompletionTime = 
                completedAssignments.length > 0 ? totalCompletionTime / completedAssignments.length : 0;

            // Get assignments by campaign
            const campaignCounts = await LeadAssignment.aggregate([
                { $match: { ...baseQuery, campaignId: { $ne: null } } },
                { $group: { _id: "$campaignId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            // Get campaign details
            const campaignIds = campaignCounts.map(item => item._id);
            const campaigns = await Campaign.find(
                { _id: { $in: campaignIds } },
                { name: 1 }
            );

            // Map campaign details to counts
            const campaignsWithDetails = campaignCounts.map(item => {
                const campaign = campaigns.find(c => c._id.toString() === item._id.toString());
                return {
                    campaignId: item._id,
                    count: item.count,
                    name: campaign ? campaign.name : 'Unknown Campaign'
                };
            });

            return res.status(200).json({
                success: true,
                data: {
                    totalAssignments,
                    statusBreakdown: statusCounts.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    completionReasons: completionReasonCounts.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    topAgents: agentsWithDetails,
                    topCampaigns: campaignsWithDetails,
                    conversionRate: parseFloat(conversionRate.toFixed(2)),
                    avgCompletionTimeHours: parseFloat(avgCompletionTime.toFixed(2))
                }
            });
        } catch (error) {
            console.error("Error in getAdminLeadAnalytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Auto-assign leads to agents
    autoAssignLeads: async (req, res) => {
        try {
            const adminId = req.adminId; // Get from auth middleware
            
            // Find unassigned users (those without an assignedAgent)
            const unassignedUsers = await User.find({
                adminId,
                assignedAgent: null,
                status: { $nin: ['inactive', 'closed'] }
            }).limit(20);
            
            if (unassignedUsers.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "No unassigned leads found",
                    data: {
                        assignedCount: 0,
                        assignments: []
                    }
                });
            }
            
            // Find available agents with capacity
            const availableAgents = await Agent.find({
                adminId,
                status: true,
                isOnline: true,
                $expr: { $lt: ["$currentLeadCount", "$leadCapacity"] }
            }).sort({ currentLeadCount: 1 });
            
            if (availableAgents.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "No available agents found",
                    data: {
                        assignedCount: 0,
                        assignments: []
                    }
                });
            }
            
            // Create assignments
            const assignments = [];
            const admin = await Admin.findById(adminId);
            
            for (const user of unassignedUsers) {
                // Use round-robin assignment - get agent with lowest lead count
                const agent = availableAgents.sort((a, b) => a.currentLeadCount - b.currentLeadCount)[0];
                
                // Skip if agent is at capacity
                if (agent.currentLeadCount >= agent.leadCapacity) {
                    continue;
                }
                
                // Create assignment
                const leadAssignment = new LeadAssignment({
                    userId: user._id,
                    agentId: agent._id,
                    adminId,
                    campaignId: user.campaignId,
                    assignedBy: adminId,
                    initialUserStatus: user.status,
                    isAutoAssigned: true
                });
                
                await leadAssignment.save();
                assignments.push(leadAssignment);
                
                // Update agent lead count
                agent.currentLeadCount += 1;
                await agent.save();
                
                // Update user's assigned agent
                user.assignedAgent = agent._id;
                await user.save();
                
                // Log activity
                await logActivity({
                    actorId: adminId,
                    actorModel: 'Admins',
                    actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                    action: 'lead_assigned',
                    entityType: 'LeadAssignment',
                    entityId: leadAssignment._id,
                    description: `Lead auto-assigned: User ${user.name || user.phone} to Agent ${agent.first_name} ${agent.last_name}`,
                    adminId
                });
                
                // Create notification for agent
                await createNotification({
                    title: "New Lead Auto-Assigned",
                    description: `A new lead (${user.name || user.phone}) has been automatically assigned to you`,
                    type: 'lead_assigned',
                    priority: 'medium',
                    forAgent: agent._id,
                    forAdmin: adminId,
                    relatedTo: {
                        model: 'User',
                        id: user._id
                    },
                    actionUrl: `/leads/${leadAssignment._id}`
                });
            }
            
            return res.status(200).json({
                success: true,
                message: `Successfully assigned ${assignments.length} leads`,
                data: {
                    assignedCount: assignments.length,
                    assignments
                }
            });
        } catch (error) {
            console.error("Error in autoAssignLeads:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete a lead assignment
    deleteAssignment: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId; // Get from auth middleware
            
            const assignment = await LeadAssignment.findById(id);
            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: "Lead assignment not found"
                });
            }
            
            // Check permissions - only admin who created the assignment can delete it
            if (assignment.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to delete this assignment"
                });
            }
            
            // Check if assignment can be deleted (only inactive or completed ones)
            if (assignment.status === 'active') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete an active assignment. Please change status first."
                });
            }
            
            // Remove the assignment
            await LeadAssignment.findByIdAndDelete(id);
            
            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'lead_assignment_deleted',
                entityType: 'LeadAssignment',
                entityId: assignment._id,
                description: `Lead assignment for user ${assignment.userId} was deleted`,
                adminId: assignment.adminId
            });
            
            return res.status(200).json({
                success: true,
                message: "Lead assignment deleted successfully"
            });
        } catch (error) {
            console.error("Error in deleteAssignment:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = LeadAssignmentController;