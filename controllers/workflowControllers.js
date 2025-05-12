// controllers/WorkflowController.js
const { Workflow } = require('../models/Workflows');
const { Admin } = require('../models/Admins');
const { Campaign } = require('../models/Campaigns');
const { UserSession } = require('../models/UserSessions');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { Message } = require('../models/Messages');
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

const WorkflowController = {
    // Create a new workflow
    createWorkflow: async (req, res) => {
        try {
            const {
                name,
                description,
                nodes,
                startNodeId,
                tags,
                category,
                isTemplate
            } = req.body;

            const adminId = req.adminId;

            // Validate required fields
            if (!name || !nodes || !startNodeId) {
                return res.status(400).json({
                    success: false,
                    message: "Name, nodes, and startNodeId are required"
                });
            }

            // Validate nodes structure
            if (!Array.isArray(nodes) || nodes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one node is required"
                });
            }

            // Validate that startNodeId exists in nodes
            const startNodeExists = nodes.some(node => node.nodeId === startNodeId);
            if (!startNodeExists) {
                return res.status(400).json({
                    success: false,
                    message: "Start node ID must reference an existing node"
                });
            }

            // Validate each node
            for (const node of nodes) {
                if (!node.nodeId || !node.name || !node.type) {
                    return res.status(400).json({
                        success: false,
                        message: "Each node must have nodeId, name, and type"
                    });
                }

                // Validate node connections
                if (node.type === 'condition') {
                    if (!node.condition || !node.trueNodeId || !node.falseNodeId) {
                        return res.status(400).json({
                            success: false,
                            message: "Condition nodes must have condition, trueNodeId, and falseNodeId"
                        });
                    }
                } else if (node.type !== 'end' && !node.nextNodeId) {
                    return res.status(400).json({
                        success: false,
                        message: "Non-end nodes must have nextNodeId"
                    });
                }
            }

            // Check if workflow name already exists
            const existingWorkflow = await Workflow.findOne({
                adminId,
                name
            });

            if (existingWorkflow) {
                return res.status(400).json({
                    success: false,
                    message: "A workflow with this name already exists"
                });
            }

            // Create workflow
            const workflow = new Workflow({
                name,
                description,
                adminId,
                nodes,
                startNodeId,
                tags: tags || [],
                category: category || 'general',
                isTemplate: isTemplate || false,
                isActive: true
            });

            await workflow.save();

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_created',
                entityType: 'Workflow',
                entityId: workflow._id,
                description: `Created workflow: ${workflow.name}`,
                adminId
            });

            return res.status(201).json({
                success: true,
                message: "Workflow created successfully",
                data: workflow
            });
        } catch (error) {
            console.error("Error in createWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all workflows for an admin
    getAdminWorkflows: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                isActive,
                isTemplate,
                category,
                search,
                tags,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (typeof isActive === 'boolean') query.isActive = isActive;
            if (typeof isTemplate === 'boolean') query.isTemplate = isTemplate;
            if (category) query.category = category;
            if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
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
            const totalCount = await Workflow.countDocuments(query);

            // Execute query with pagination
            const workflows = await Workflow.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get usage statistics for each workflow
            const workflowsWithStats = await Promise.all(
                workflows.map(async (workflow) => {
                    const sessionCount = await UserSession.countDocuments({
                        workflowId: workflow._id
                    });

                    const campaignCount = await Campaign.countDocuments({
                        workflowId: workflow._id
                    });

                    return {
                        ...workflow.toObject(),
                        usage: {
                            sessionCount,
                            campaignCount
                        }
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: workflowsWithStats,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminWorkflows:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflow by ID
    getWorkflow: async (req, res) => {
        try {
            const { id } = req.params;

            const workflow = await Workflow.findById(id);

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check permissions
            if (workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this workflow"
                });
            }

            // Get usage statistics
            const sessionCount = await UserSession.countDocuments({
                workflowId: workflow._id
            });

            const campaignCount = await Campaign.countDocuments({
                workflowId: workflow._id
            });

            // Get recent sessions using this workflow
            const recentSessions = await UserSession.find({
                workflowId: workflow._id
            })
            .populate('userId', 'name phone')
            .sort({ createdAt: -1 })
            .limit(5);

            return res.status(200).json({
                success: true,
                data: {
                    workflow: workflow.toObject(),
                    usage: {
                        sessionCount,
                        campaignCount
                    },
                    recentSessions
                }
            });
        } catch (error) {
            console.error("Error in getWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update workflow
    updateWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                description,
                nodes,
                startNodeId,
                tags,
                category,
                isActive
            } = req.body;

            const workflow = await Workflow.findById(id);

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check permissions
            if (workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this workflow"
                });
            }

            // If nodes are being updated, validate them
            if (nodes) {
                if (!Array.isArray(nodes) || nodes.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: "At least one node is required"
                    });
                }

                // Validate each node
                for (const node of nodes) {
                    if (!node.nodeId || !node.name || !node.type) {
                        return res.status(400).json({
                            success: false,
                            message: "Each node must have nodeId, name, and type"
                        });
                    }
                }
            }

            // If startNodeId is being updated, validate it exists in nodes
            if (startNodeId && nodes) {
                const startNodeExists = nodes.some(node => node.nodeId === startNodeId);
                if (!startNodeExists) {
                    return res.status(400).json({
                        success: false,
                        message: "Start node ID must reference an existing node"
                    });
                }
            }

            // Check if name is being changed to an existing name
            if (name && name !== workflow.name) {
                const existingWorkflow = await Workflow.findOne({
                    adminId: workflow.adminId,
                    name,
                    _id: { $ne: workflow._id }
                });

                if (existingWorkflow) {
                    return res.status(400).json({
                        success: false,
                        message: "A workflow with this name already exists"
                    });
                }
            }

            // Check if workflow is in use before making major changes
            if (nodes || startNodeId) {
                const activeSessionCount = await UserSession.countDocuments({
                    workflowId: workflow._id,
                    status: 'active'
                });

                if (activeSessionCount > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot update workflow structure while ${activeSessionCount} active sessions are using it`
                    });
                }
            }

            // Update workflow version when nodes change
            if (nodes) {
                workflow.version = workflow.version + 1;
            }

            // Update workflow fields
            if (name) workflow.name = name;
            if (description !== undefined) workflow.description = description;
            if (nodes) workflow.nodes = nodes;
            if (startNodeId) workflow.startNodeId = startNodeId;
            if (tags) workflow.tags = tags;
            if (category) workflow.category = category;
            if (typeof isActive === 'boolean') workflow.isActive = isActive;

            await workflow.save();

            // Get admin details for logging
            const admin = await Admin.findById(req.adminId);

            // Log activity
            await logActivity({
                actorId: req.adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_updated',
                entityType: 'Workflow',
                entityId: workflow._id,
                description: `Updated workflow: ${workflow.name}`,
                adminId: workflow.adminId
            });

            return res.status(200).json({
                success: true,
                message: "Workflow updated successfully",
                data: workflow
            });
        } catch (error) {
            console.error("Error in updateWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete workflow
    deleteWorkflow: async (req, res) => {
        try {
            const { id } = req.params;

            const workflow = await Workflow.findById(id);

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check permissions
            if (workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to delete this workflow"
                });
            }

            // Check if workflow is in use
            const sessionCount = await UserSession.countDocuments({
                workflowId: workflow._id
            });

            const campaignCount = await Campaign.countDocuments({
                workflowId: workflow._id
            });

            if (sessionCount > 0 || campaignCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete workflow used by ${sessionCount} sessions and ${campaignCount} campaigns`
                });
            }

            // Delete the workflow
            await Workflow.findByIdAndDelete(id);

            // Get admin details for logging
            const admin = await Admin.findById(req.adminId);

            // Log activity
            await logActivity({
                actorId: req.adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_deleted',
                entityType: 'Workflow',
                entityId: workflow._id,
                description: `Deleted workflow: ${workflow.name}`,
                adminId: workflow.adminId
            });

            return res.status(200).json({
                success: true,
                message: "Workflow deleted successfully"
            });
        } catch (error) {
            console.error("Error in deleteWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Clone workflow
    cloneWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Name is required for cloned workflow"
                });
            }

            const sourceWorkflow = await Workflow.findById(id);

            if (!sourceWorkflow) {
                return res.status(404).json({
                    success: false,
                    message: "Source workflow not found"
                });
            }

            // Check permissions
            if (sourceWorkflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to clone this workflow"
                });
            }

            // Check if new name already exists
            const existingWorkflow = await Workflow.findOne({
                adminId: req.adminId,
                name
            });

            if (existingWorkflow) {
                return res.status(400).json({
                    success: false,
                    message: "A workflow with this name already exists"
                });
            }

            // Create cloned workflow
            const clonedWorkflow = new Workflow({
                name,
                description: description || `Clone of ${sourceWorkflow.name}`,
                adminId: req.adminId,
                nodes: sourceWorkflow.nodes,
                startNodeId: sourceWorkflow.startNodeId,
                tags: sourceWorkflow.tags,
                category: sourceWorkflow.category,
                isTemplate: false,
                isActive: true,
                version: 1
            });

            await clonedWorkflow.save();

            // Get admin details for logging
            const admin = await Admin.findById(req.adminId);

            // Log activity
            await logActivity({
                actorId: req.adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'workflow_created',
                entityType: 'Workflow',
                entityId: clonedWorkflow._id,
                description: `Cloned workflow: ${clonedWorkflow.name} from ${sourceWorkflow.name}`,
                adminId: req.adminId
            });

            return res.status(201).json({
                success: true,
                message: "Workflow cloned successfully",
                data: clonedWorkflow
            });
        } catch (error) {
            console.error("Error in cloneWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflow templates
    getWorkflowTemplates: async (req, res) => {
        try {
            const {
                category,
                search,
                tags,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query for templates
            const query = { isTemplate: true };

            if (category) query.category = category;
            if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
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
            const totalCount = await Workflow.countDocuments(query);

            // Execute query with pagination
            const templates = await Workflow.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: templates,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getWorkflowTemplates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Test workflow with sample data
    testWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const { testData } = req.body;

            const workflow = await Workflow.findById(id);

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check permissions
            if (workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to test this workflow"
                });
            }

            // Simple workflow test simulation
            const testResults = [];
            let currentNodeId = workflow.startNodeId;
            let testSession = { data: testData || {} };
            let stepCount = 0;
            const maxSteps = 100; // Prevent infinite loops

            while (currentNodeId && stepCount < maxSteps) {
                const currentNode = workflow.nodes.find(node => node.nodeId === currentNodeId);
                
                if (!currentNode) {
                    testResults.push({
                        step: stepCount,
                        nodeId: currentNodeId,
                        error: "Node not found"
                    });
                    break;
                }

                const result = {
                    step: stepCount,
                    nodeId: currentNodeId,
                    nodeName: currentNode.name,
                    nodeType: currentNode.type,
                    data: { ...testSession.data }
                };

                // Simulate node execution
                switch (currentNode.type) {
                    case 'message':
                        result.output = currentNode.content;
                        currentNodeId = currentNode.nextNodeId;
                        break;

                    case 'input':
                        result.output = `Waiting for input: ${currentNode.variableName}`;
                        if (testData && testData[currentNode.variableName]) {
                            testSession.data[currentNode.variableName] = testData[currentNode.variableName];
                            result.collectedData = { [currentNode.variableName]: testData[currentNode.variableName] };
                        }
                        currentNodeId = currentNode.nextNodeId;
                        break;

                    case 'condition':
                        // Simple condition evaluation for testing
                        const conditionResult = testSession.data[currentNode.variableName] === testData[currentNode.variableName];
                        result.conditionResult = conditionResult;
                        currentNodeId = conditionResult ? currentNode.trueNodeId : currentNode.falseNodeId;
                        break;

                    case 'api':
                        result.output = `API call to: ${currentNode.apiEndpoint}`;
                        currentNodeId = currentNode.nextNodeId;
                        break;

                    default:
                        currentNodeId = currentNode.nextNodeId;
                }

                testResults.push(result);
                stepCount++;

                // End node or no next node
                if (!currentNodeId || currentNode.type === 'end') {
                    break;
                }
            }

            return res.status(200).json({
                success: true,
                message: "Workflow test completed",
                data: {
                    workflowId: workflow._id,
                    workflowName: workflow.name,
                    testResults,
                    finalData: testSession.data,
                    stepsExecuted: stepCount
                }
            });
        } catch (error) {
            console.error("Error in testWorkflow:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get workflow analytics
    getWorkflowAnalytics: async (req, res) => {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;

            const workflow = await Workflow.findById(id);

            if (!workflow) {
                return res.status(404).json({
                    success: false,
                    message: "Workflow not found"
                });
            }

            // Check permissions
            if (workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view analytics for this workflow"
                });
            }

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Base query
            const baseQuery = { workflowId: workflow._id, ...dateFilter };

            // Get session statistics
            const totalSessions = await UserSession.countDocuments(baseQuery);

            const sessionsByStatus = await UserSession.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get completion rate
            const completedSessions = sessionsByStatus.find(item => item._id === 'completed')?.count || 0;
            const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

            // Get average session duration
            const completedSessionsData = await UserSession.find({
                ...baseQuery,
                status: 'completed',
                startedAt: { $ne: null },
                completedAt: { $ne: null }
            });

            let totalDuration = 0;
            completedSessionsData.forEach(session => {
                const duration = session.completedAt.getTime() - session.startedAt.getTime();
                totalDuration += duration;
            });

            const avgSessionDuration = completedSessionsData.length > 0
                ? Math.floor(totalDuration / completedSessionsData.length / 1000) // in seconds
                : 0;

            // Get node analytics
            const nodeAnalytics = {};
            const sessions = await UserSession.find(baseQuery);

            sessions.forEach(session => {
                if (session.stepsCompleted) {
                    session.stepsCompleted.forEach(nodeId => {
                        if (!nodeAnalytics[nodeId]) {
                            nodeAnalytics[nodeId] = { visits: 0 };
                        }
                        nodeAnalytics[nodeId].visits++;
                    });
                }
            });

            // Add node names to analytics
            workflow.nodes.forEach(node => {
                if (nodeAnalytics[node.nodeId]) {
                    nodeAnalytics[node.nodeId].name = node.name;
                    nodeAnalytics[node.nodeId].type = node.type;
                }
            });

            // Get drop-off points
            const dropOffPoints = {};
            sessions.forEach(session => {
                if (session.status === 'abandoned' && session.currentNodeId) {
                    if (!dropOffPoints[session.currentNodeId]) {
                        dropOffPoints[session.currentNodeId] = { count: 0 };
                    }
                    dropOffPoints[session.currentNodeId].count++;
                }
            });

            // Add node names to drop-off points
            workflow.nodes.forEach(node => {
                if (dropOffPoints[node.nodeId]) {
                    dropOffPoints[node.nodeId].name = node.name;
                    dropOffPoints[node.nodeId].type = node.type;
                }
            });

            return res.status(200).json({
                success: true,
                data: {
                    workflowId: workflow._id,
                    workflowName: workflow.name,
                    totalSessions,
                    sessionsByStatus: sessionsByStatus.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    avgSessionDurationSeconds: avgSessionDuration,
                    nodeAnalytics,
                    dropOffPoints
                }
            });
        } catch (error) {
            console.error("Error in getWorkflowAnalytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = WorkflowController;