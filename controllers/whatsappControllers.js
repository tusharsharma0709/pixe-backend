// controllers/WhatsAppController.js
const { Message } = require('../models/Messages');
const { User } = require('../models/Users');
const { Agent } = require('../models/Agents');
const { Admin } = require('../models/Admins');
const { UserSession } = require('../models/UserSessions');
const { Workflow } = require('../models/Workflows');
const { Campaign } = require('../models/Campaigns');
const { WhatsappNumber } = require('../models/WhatsappNumber');
const { WhatsappTemplate } = require('../models/WhatsappTemplates');
const { LeadAssignment } = require('../models/LeadAssignments');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const axios = require('axios');
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

// Helper function to send WhatsApp message via API
const sendWhatsAppMessage = async (phoneNumber, message, messageType = 'text', mediaUrl = null) => {
    try {
        const apiUrl = process.env.WHATSAPP_API_URL;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        
        const payload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: messageType
        };

        if (messageType === 'text') {
            payload.text = { body: message };
        } else if (messageType === 'image') {
            payload.image = { link: mediaUrl, caption: message };
        } else if (messageType === 'document') {
            payload.document = { link: mediaUrl, caption: message };
        } else if (messageType === 'template') {
            payload.template = message; // message should be template object
        }

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, data: response.data };
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
        return { success: false, error: error.message };
    }
};

const WhatsAppController = {
    // Webhook to receive WhatsApp messages
    receiveWebhook: async (req, res) => {
        try {
            const { entry } = req.body;

            if (!entry || !entry.length) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid webhook data"
                });
            }

            // Process each entry
            for (const entryItem of entry) {
                const changes = entryItem.changes;
                
                for (const change of changes) {
                    if (change.field === 'messages') {
                        const messageData = change.value;
                        
                        if (messageData.messages) {
                            for (const message of messageData.messages) {
                                await processIncomingMessage(message, messageData.metadata);
                            }
                        }
                    }
                }
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error in receiveWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Verify webhook (required by WhatsApp)
    verifyWebhook: async (req, res) => {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode && token) {
                if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
                    console.log('Webhook verified');
                    return res.status(200).send(challenge);
                } else {
                    return res.status(403).json({
                        success: false,
                        message: "Invalid verification token"
                    });
                }
            }

            return res.status(400).json({
                success: false,
                message: "Missing verification parameters"
            });
        } catch (error) {
            console.error("Error in verifyWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Process workflow for user
    processWorkflowMessage: async (req, res) => {
        try {
            const { sessionId, messageContent } = req.body;

            const session = await UserSession.findById(sessionId)
                .populate('workflowId')
                .populate('userId');

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }

            const workflow = session.workflowId;
            const currentNode = workflow.nodes.find(node => node.nodeId === session.currentNodeId);

            if (!currentNode) {
                return res.status(400).json({
                    success: false,
                    message: "Current workflow node not found"
                });
            }

            // Process based on node type
            let nextNodeId;
            let responseMessage;
            let sessionData = { ...session.data };

            switch (currentNode.type) {
                case 'message':
                    responseMessage = currentNode.content;
                    nextNodeId = currentNode.nextNodeId;
                    break;

                case 'input':
                    // Store user input
                    sessionData[currentNode.variableName] = messageContent;
                    nextNodeId = currentNode.nextNodeId;
                    break;

                case 'condition':
                    // Evaluate condition
                    const conditionResult = evaluateCondition(
                        currentNode.condition,
                        sessionData
                    );
                    nextNodeId = conditionResult ? currentNode.trueNodeId : currentNode.falseNodeId;
                    break;

                default:
                    nextNodeId = currentNode.nextNodeId;
            }

            // Update session
            session.currentNodeId = nextNodeId;
            session.previousNodeId = currentNode.nodeId;
            session.data = sessionData;
            session.lastInteractionAt = new Date();
            session.interactionCount += 1;

            // Add to completed steps
            if (!session.stepsCompleted.includes(currentNode.nodeId)) {
                session.stepsCompleted.push(currentNode.nodeId);
            }

            // Check if workflow completed
            if (!nextNodeId || nextNodeId === 'end') {
                session.status = 'completed';
                session.completedAt = new Date();
            }

            await session.save();

            // Get next node response if exists
            if (nextNodeId && nextNodeId !== 'end') {
                const nextNode = workflow.nodes.find(node => node.nodeId === nextNodeId);
                if (nextNode && nextNode.type === 'message') {
                    responseMessage = nextNode.content;
                }
            }

            // Send response to user
            if (responseMessage) {
                await sendWhatsAppMessage(
                    session.userId.phone,
                    responseMessage
                );
            }

            return res.status(200).json({
                success: true,
                message: "Workflow processed successfully",
                data: {
                    nextNodeId,
                    sessionData,
                    completed: session.status === 'completed'
                }
            });
        } catch (error) {
            console.error("Error in processWorkflowMessage:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get WhatsApp templates
    getWhatsAppTemplates: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { status, category, search, page = 1, limit = 10 } = req.query;

            const query = { adminId };

            if (status) query.status = status;
            if (category) query.category = category;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const totalCount = await WhatsappTemplate.countDocuments(query);

            const templates = await WhatsappTemplate.find(query)
                .sort({ createdAt: -1 })
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
            console.error("Error in getWhatsAppTemplates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Create WhatsApp template
    createWhatsAppTemplate: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { name, category, language, components } = req.body;

            // Validate required fields
            if (!name || !category || !components) {
                return res.status(400).json({
                    success: false,
                    message: "Name, category, and components are required"
                });
            }

            const template = new WhatsappTemplate({
                name,
                adminId,
                category,
                language: language || 'en_US',
                components,
                status: 'draft'
            });

            await template.save();

            return res.status(201).json({
                success: true,
                message: "WhatsApp template created successfully",
                data: template
            });
        } catch (error) {
            console.error("Error in createWhatsAppTemplate:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

// Helper function to process incoming messages
async function processIncomingMessage(message, metadata) {
    try {
        const { from: phoneNumber, type, text, id: whatsappMessageId } = message;
        
        // Find user by phone number
        let user = await User.findOne({ phone: phoneNumber });
        
        if (!user) {
            // Create new user
            user = new User({
                phone: phoneNumber,
                source: 'whatsapp',
                status: 'new'
            });
            await user.save();
        }

        // Find active session
        let session = await UserSession.findOne({
            userId: user._id,
            status: 'active'
        }).populate('workflowId');

        // If no active session and message is from new conversation, create one
        if (!session && message.context) {
            // This might be a response to a campaign
            // Try to find campaign from context
            const campaign = await Campaign.findOne({
                facebookCampaignId: message.context.id
            });

            if (campaign && campaign.workflowId) {
                // Create new session
                session = new UserSession({
                    userId: user._id,
                    phone: user.phone,
                    campaignId: campaign._id,
                    workflowId: campaign.workflowId,
                    adminId: campaign.adminId,
                    source: 'whatsapp',
                    status: 'active'
                });
                
                await session.save();
            }
        }

        if (session) {
            // Create message record
            const messageRecord = new Message({
                sessionId: session._id,
                userId: user._id,
                adminId: session.adminId,
                campaignId: session.campaignId,
                sender: 'user',
                messageType: type,
                content: text?.body || '',
                status: 'delivered',
                whatsappMessageId
            });

            await messageRecord.save();

            // Process workflow if applicable
            if (session.workflowId) {
                const workflow = await Workflow.findById(session.workflowId);
                
                if (workflow) {
                    const currentNode = workflow.nodes.find(
                        node => node.nodeId === session.currentNodeId
                    );

                    if (currentNode && currentNode.type === 'input') {
                        // Store user input and proceed to next node
                        session.data[currentNode.variableName] = text?.body;
                        session.currentNodeId = currentNode.nextNodeId;
                        session.lastInteractionAt = new Date();
                        await session.save();

                        // Send next node message if it's a message node
                        const nextNode = workflow.nodes.find(
                            node => node.nodeId === currentNode.nextNodeId
                        );

                        if (nextNode && nextNode.type === 'message') {
                            await sendWhatsAppMessage(
                                phoneNumber,
                                nextNode.content
                            );
                        }
                    }
                }
            }
        }

        // Check if user has an assigned agent and forward message
        const leadAssignment = await LeadAssignment.findOne({
            userId: user._id,
            status: 'active'
        });

        if (leadAssignment && leadAssignment.agentId) {
            // Notify agent about new message
            await Notification.create({
                title: "New message from user",
                description: `${user.name || user.phone} sent a message`,
                type: 'message',
                priority: 'high',
                forAgent: leadAssignment.agentId,
                relatedTo: {
                    model: 'Message',
                    id: messageRecord._id
                }
            });
        }
    } catch (error) {
        console.error("Error processing incoming message:", error);
    }
}

// Helper function to evaluate conditions
function evaluateCondition(condition, data) {
    try {
        // Simple condition evaluation
        // You can make this more sophisticated based on your needs
        return new Function('data', `return ${condition}`)(data);
    } catch (error) {
        console.error("Error evaluating condition:", error);
        return false;
    }
}

module.exports = WhatsAppController;