// controllers/WorkflowController.js
const { Workflow } = require('../models/Workflows');
const { Admin } = require('../models/Admins');
const { Campaign } = require('../models/Campaigns');
const { UserSession } = require('../models/UserSessions');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { Message } = require('../models/Messages');
const axios=require('axios')
const mongoose = require('mongoose');
const { User } = require('../models/Users');
const ObjectId = mongoose.Types.ObjectId;
const whatsappService = require('../services/whatsappServices')
// Create a message queue service
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.delay = 3000; // 3 seconds between messages
    }
    
    async add(phoneNumber, message) {
        this.queue.push({ phoneNumber, message, attempts: 0 });
        if (!this.processing) {
            this.process();
        }
    }
    
    async process() {
        this.processing = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            try {
                await whatsappService.sendMessage(item.phoneNumber, item.message);
                await new Promise(resolve => setTimeout(resolve, this.delay));
            } catch (error) {
                if (error.message.includes('131056') && item.attempts < 3) {
                    console.log('Rate limit hit, requeueing with longer delay...');
                    item.attempts++;
                    this.queue.unshift(item); // Put back at front
                    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
                } else {
                    console.error('Failed to send message:', error);
                }
            }
        }
        
        this.processing = false;
    }
}

const messageQueue = new MessageQueue();

// helpers/workflowHelpers.js
function evaluateCondition(condition, data) {
    try {
        if (!condition) return false;
        
        // Simple evaluation - you can make this more sophisticated
        // Example condition: "creditScore > 700"
        const conditionRegex = /(\w+)\s*(>|<|==|!=|>=|<=)\s*(.+)/;
        const match = condition.match(conditionRegex);
        
        if (!match) return false;
        
        const [, field, operator, value] = match;
        const fieldValue = data[field];
        
        if (fieldValue === undefined) return false;
        
        // Convert to numbers if possible
        const numFieldValue = Number(fieldValue);
        const numValue = Number(value);
        const useNumbers = !isNaN(numFieldValue) && !isNaN(numValue);
        
        switch (operator) {
            case '>':
                return useNumbers ? numFieldValue > numValue : fieldValue > value;
            case '<':
                return useNumbers ? numFieldValue < numValue : fieldValue < value;
            case '>=':
                return useNumbers ? numFieldValue >= numValue : fieldValue >= value;
            case '<=':
                return useNumbers ? numFieldValue <= numValue : fieldValue <= value;
            case '==':
                return fieldValue == value;
            case '!=':
                return fieldValue != value;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
    }
}

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
                error: error
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
            const { testData, phoneNumber, sendMessages = false, interactiveMode = false } = req.body;
    
            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number is required for testing"
                });
            }
    
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
    
            // Interactive mode - create real session for conversation flow
            if (interactiveMode && sendMessages) {
                // Import required models
                const { User } = require('../models/Users');
                const { UserSession } = require('../models/UserSessions');
                
                // Find or create user
                let user = await User.findOne({ phone: phoneNumber });
                if (!user) {
                    user = new User({
                        phone: phoneNumber,
                        adminId: workflow.adminId,
                        workflowId: workflow._id,
                        status: 'active',
                        source: 'whatsapp'  // Changed to valid source
                    });
                    await user.save();
                }
    
                // Check if there's already an active session
                let existingSession = await UserSession.findOne({
                    userId: user._id,
                    status: 'active',
                    workflowId: workflow._id
                });
    
                if (existingSession) {
                    return res.status(200).json({
                        success: true,
                        message: "Active session already exists",
                        data: {
                            sessionId: existingSession._id,
                            userId: user._id,
                            currentNodeId: existingSession.currentNodeId,
                            instructions: "Use webhook endpoint to send user messages"
                        }
                    });
                }
    
                // Create new session
                const session = new UserSession({
                    userId: user._id,
                    phone: phoneNumber,
                    workflowId: workflow._id,
                    adminId: workflow.adminId,
                    currentNodeId: workflow.startNodeId,
                    data: testData || {},
                    status: 'active',
                    source: 'whatsapp'
                });
                await session.save();
    
                // Execute the workflow
                const { executeWorkflowNode } = require('../services/workflowExecutor');
                await executeWorkflowNode(session, workflow.startNodeId);
    
                return res.status(200).json({
                    success: true,
                    message: "Interactive workflow test started",
                    data: {
                        sessionId: session._id,
                        userId: user._id,
                        currentNodeId: session.currentNodeId,
                        webhook: "/api/message/webhook/receive",
                        instructions: "Messages have been sent to WhatsApp. Send user responses to the webhook endpoint."
                    }
                });
            }
    
            // Non-interactive mode - simulate full workflow
            const testResults = [];
            let currentNodeId = workflow.startNodeId;
            let testSession = { data: testData || {} };
            let stepCount = 0;
            const maxSteps = 100;
            let messagesSent = 0;
            const maxMessagesPerMinute = 10;
            const messageStartTime = Date.now();
    
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
    
                // Execute node based on type
                switch (currentNode.type) {
                    case 'message':
                        result.output = currentNode.content;
                        
                        // Send actual WhatsApp message with rate limiting
                        if (sendMessages && currentNode.content) {
                            try {
                                // Check rate limits
                                const elapsedMinutes = (Date.now() - messageStartTime) / 60000;
                                if (messagesSent >= maxMessagesPerMinute && elapsedMinutes < 1) {
                                    const waitTime = (1 - elapsedMinutes) * 60000;
                                    console.log(`Rate limit approaching, waiting ${Math.ceil(waitTime/1000)} seconds...`);
                                    await new Promise(resolve => setTimeout(resolve, waitTime));
                                }
    
                                // Replace variables in message content
                                let messageContent = currentNode.content;
                                for (const [key, value] of Object.entries(testSession.data)) {
                                    messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
                                }
                                
                                // Send message via WhatsApp
                                const messageResult = await whatsappService.sendMessage(
                                    phoneNumber, 
                                    messageContent
                                );
                                
                                result.messageSent = true;
                                result.messageId = messageResult.message_id;
                                result.actualMessage = messageContent;
                                messagesSent++;
                                
                                // Wait between messages to avoid rate limits
                                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
                                
                            } catch (sendError) {
                                console.error('Error sending message:', sendError);
                                result.messageSent = false;
                                result.sendError = sendError.response?.data?.error?.message || sendError.message;
                                
                                // If rate limit error, wait longer
                                if (sendError.message?.includes('131056')) {
                                    console.log('Rate limit hit, waiting 30 seconds...');
                                    await new Promise(resolve => setTimeout(resolve, 30000));
                                }
                            }
                        } else {
                            result.messageSent = false;
                            result.reason = sendMessages ? "No content to send" : "Message sending disabled";
                        }
                        
                        currentNodeId = currentNode.nextNodeId;
                        break;
    
                    case 'input':
                        result.output = `Waiting for input: ${currentNode.variableName}`;
                        
                        // Send input prompt message if content exists
                        if (sendMessages && currentNode.content) {
                            try {
                                // Rate limit check
                                if (messagesSent >= maxMessagesPerMinute) {
                                    await new Promise(resolve => setTimeout(resolve, 60000));
                                    messagesSent = 0;
                                }
    
                                const messageResult = await whatsappService.sendMessage(
                                    phoneNumber, 
                                    currentNode.content
                                );
                                result.promptSent = true;
                                result.messageId = messageResult.message_id;
                                messagesSent++;
                                
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            } catch (sendError) {
                                result.promptSent = false;
                                result.sendError = sendError.response?.data?.error?.message || sendError.message;
                            }
                        }
                        
                        // For testing, use provided test data
                        if (testData && testData[currentNode.variableName]) {
                            testSession.data[currentNode.variableName] = testData[currentNode.variableName];
                            result.collectedData = { [currentNode.variableName]: testData[currentNode.variableName] };
                        } else {
                            result.output += " (No test data provided, skipping)";
                        }
                        
                        currentNodeId = currentNode.nextNodeId;
                        break;
    
                    case 'condition':
                        // Evaluate condition
                        const conditionResult = evaluateCondition(
                            currentNode.condition, 
                            testSession.data
                        );
                        result.conditionResult = conditionResult;
                        result.evaluatedCondition = currentNode.condition;
                        currentNodeId = conditionResult ? currentNode.trueNodeId : currentNode.falseNodeId;
                        break;
    
                    case 'api':
                        result.output = `API call to: ${currentNode.apiEndpoint}`;
                        
                        // Make actual API call if enabled and endpoint exists
                        if (sendMessages && currentNode.apiEndpoint) {
                            try {
                                const axios = require('axios');
                                const apiResponse = await axios({
                                    method: currentNode.apiMethod || 'GET',
                                    url: currentNode.apiEndpoint,
                                    data: currentNode.apiParams || {},
                                    timeout: 10000
                                });
                                result.apiResponse = apiResponse.data;
                                result.apiStatus = apiResponse.status;
                            } catch (apiError) {
                                result.apiError = apiError.message;
                                result.apiStatus = apiError.response?.status;
                            }
                        }
                        
                        currentNodeId = currentNode.nextNodeId;
                        break;
    
                    default:
                        result.output = `Node type: ${currentNode.type}`;
                        currentNodeId = currentNode.nextNodeId;
                }
    
                testResults.push(result);
                stepCount++;
    
                // End node or no next node
                if (!currentNodeId || currentNode.type === 'end') {
                    break;
                }
    
                // Safety check for self-referencing nodes
                if (currentNodeId === currentNode.nodeId) {
                    result.warning = "Self-referencing node detected, stopping execution";
                    break;
                }
            }
    
            return res.status(200).json({
                success: true,
                message: "Workflow test completed",
                data: {
                    workflowId: workflow._id,
                    workflowName: workflow.name,
                    phoneNumber: phoneNumber,
                    messagesEnabled: sendMessages,
                    mode: interactiveMode ? "interactive" : "simulation",
                    testResults,
                    finalData: testSession.data,
                    stepsExecuted: stepCount,
                    messagesSent: messagesSent,
                    warnings: messagesSent >= maxMessagesPerMinute ? 
                        "Rate limit approached during testing. Some messages may have been delayed." : null
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
    
    // Helper function for condition evaluation
    // evaluateCondition: function(condition, data) {
    //     try {
    //         // Handle length checks
    //         const lengthRegex = /(\w+)\.length\s*(>|<|>=|<=)\s*(\d+)/;
    //         const lengthMatch = condition.match(lengthRegex);
            
    //         if (lengthMatch) {
    //             const [, field, operator, value] = lengthMatch;
    //             const fieldValue = data[field];
    //             if (!fieldValue) return false;
                
    //             const length = fieldValue.length;
    //             const compareValue = parseInt(value);
                
    //             switch (operator) {
    //                 case '>': return length > compareValue;
    //                 case '<': return length < compareValue;
    //                 case '>=': return length >= compareValue;
    //                 case '<=': return length <= compareValue;
    //             }
    //         }
            
    //         // Handle includes checks
    //         const includesRegex = /(\w+)\.includes\(['"](.+)['"]\)/;
    //         const includesMatch = condition.match(includesRegex);
            
    //         if (includesMatch) {
    //             const [, field, searchValue] = includesMatch;
    //             const fieldValue = data[field];
    //             return fieldValue && fieldValue.includes(searchValue);
    //         }
            
    //         return false;
    //     } catch (error) {
    //         console.error('Error evaluating condition:', error);
    //         return false;
    //     }
    // },

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