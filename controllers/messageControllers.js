// controllers/MessageController.js
const { Message } = require('../models/Messages');
const { User } = require('../models/Users');
const { Agent } = require('../models/Agents');
const { Admin } = require('../models/Admins');
const { UserSession } = require('../models/UserSessions');
const { LeadAssignment } = require('../models/LeadAssignments');
const { Campaign } = require('../models/Campaigns');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { FileUpload } = require('../models/FileUploads');
const axios = require('axios');
const mongoose = require('mongoose');
const { processWorkflowInput } = require('../services/workflowExecutor');
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

// Helper function to send WhatsApp message via API
const sendWhatsAppMessage = async (phoneNumber, message, messageType = 'text', mediaUrl = null) => {
    try {
        // This would integrate with WhatsApp Business API
        // For now, it's a placeholder function
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

const MessageController = {
    // Send message from agent to user
    sendMessage: async (req, res) => {
        try {
            const {
                userId,
                sessionId,
                content,
                messageType = 'text',
                mediaUrl,
                metadata
            } = req.body;

            const agentId = req.agentId;

            // Validate required fields
            if (!userId || !content) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and content are required"
                });
            }

            // Check if agent has access to this user
            const leadAssignment = await LeadAssignment.findOne({
                userId,
                agentId,
                status: 'active'
            });

            if (!leadAssignment) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to message this user"
                });
            }

            // Get user details
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Get or create session
            let session = null;
            if (sessionId) {
                session = await UserSession.findById(sessionId);
            } else {
                // Find active session for this user
                session = await UserSession.findOne({
                    userId,
                    status: 'active'
                }).sort({ createdAt: -1 });
            }

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "No active session found"
                });
            }

            // Send WhatsApp message
            const whatsappResult = await sendWhatsAppMessage(
                user.phone,
                content,
                messageType,
                mediaUrl
            );

            if (!whatsappResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to send WhatsApp message",
                    error: whatsappResult.error
                });
            }

            // Create message record
            const message = new Message({
                sessionId: session._id,
                userId,
                agentId,
                adminId: session.adminId,
                campaignId: session.campaignId,
                sender: 'agent',
                messageType,
                content,
                metadata,
                mediaUrl,
                mediaType: messageType,
                status: 'sent',
                whatsappMessageId: whatsappResult.data.messages?.[0]?.id
            });

            await message.save();

            // Update session activity
            session.lastInteractionAt = new Date();
            session.interactionCount += 1;
            await session.save();

            // Get agent details for logging
            const agent = await Agent.findById(agentId);

            // Log activity
            await logActivity({
                actorId: agentId,
                actorModel: 'Agents',
                actorName: agent ? `${agent.first_name} ${agent.last_name}` : null,
                action: 'message_sent',
                entityType: 'Message',
                entityId: message._id,
                description: `Agent sent message to user ${user.name || user.phone}`,
                adminId: session.adminId
            });

            return res.status(201).json({
                success: true,
                message: "Message sent successfully",
                data: message
            });
        } catch (error) {
            console.error("Error in sendMessage:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get messages for a session
    getSessionMessages: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            // Validate permissions
            const session = await UserSession.findById(sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }

            // Check if agent has access
            if (req.agentId) {
                const leadAssignment = await LeadAssignment.findOne({
                    userId: session.userId,
                    agentId: req.agentId,
                    status: 'active'
                });

                if (!leadAssignment) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to view these messages"
                    });
                }
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Message.countDocuments({ sessionId });

            // Execute query with pagination
            const messages = await Message.find({ sessionId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: messages,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getSessionMessages:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get messages for a user
    getUserMessages: async (req, res) => {
        try {
            const { userId } = req.params;
            const { sessionId, startDate, endDate, page = 1, limit = 50 } = req.query;

            // Build query
            const query = { userId };

            if (sessionId) query.sessionId = sessionId;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Check permissions
            if (req.agentId) {
                const leadAssignment = await LeadAssignment.findOne({
                    userId,
                    agentId: req.agentId,
                    status: 'active'
                });

                if (!leadAssignment) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to view these messages"
                    });
                }

                query.agentId = req.agentId;
            }

            if (req.adminId) {
                query.adminId = req.adminId;
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Message.countDocuments(query);

            // Execute query with pagination
            const messages = await Message.find(query)
                .populate('sessionId', 'workflowId currentNodeId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: messages,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getUserMessages:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // In MessageController.js
    receiveMessage: async (req, res) => {
        try {
            // WhatsApp sends data in this specific format
            const { entry } = req.body;
            
            if (!entry || !entry[0] || !entry[0].changes) {
                return res.sendStatus(200);
            }
            
            const changes = entry[0].changes[0];
            const value = changes.value;
            
            // Handle different types of webhooks (messages, statuses, etc.)
            if (value.messages && value.messages[0]) {
                // Handle incoming message
                const message = value.messages[0];
                const phoneNumber = message.from; // Format: 919302239283 (without +)
                const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
                const whatsappMessageId = message.id;
                
                // Process message based on type
                let content, messageType, mediaUrl, mediaName, mediaSize, metadata;
                
                // Determine message type
                messageType = message.type || 'text';
                
                switch (messageType) {
                    case 'text':
                        content = message.text?.body || '';
                        break;
                    case 'interactive':
                        // Handle interactive message responses (buttons, lists)
                        if (message.interactive.type === 'button_reply') {
                            const buttonReply = message.interactive.button_reply;
                            content = buttonReply.id; // Use button ID as content
                            metadata = {
                                buttonTitle: buttonReply.title,
                                buttonId: buttonReply.id,
                                interactiveType: 'button'
                            };
                            console.log(`Received button response: ID=${buttonReply.id}, Title=${buttonReply.title}`);
                        } 
                        else if (message.interactive.type === 'list_reply') {
                            const listReply = message.interactive.list_reply;
                            content = listReply.id; // Use list item ID as content
                            metadata = {
                                listItemTitle: listReply.title,
                                listItemId: listReply.id,
                                interactiveType: 'list'
                            };
                            console.log(`Received list response: ID=${listReply.id}, Title=${listReply.title}`);
                        } 
                        else {
                            content = `Received interactive message of type: ${message.interactive.type}`;
                            metadata = { interactiveType: message.interactive.type };
                        }
                        break;
                    case 'image':
                        content = message.image?.caption || 'Image received';
                        mediaUrl = message.image?.url;
                        mediaType = 'image';
                        break;
                    case 'document':
                        content = message.document?.caption || 'Document received';
                        mediaUrl = message.document?.url;
                        mediaName = message.document?.filename;
                        mediaSize = message.document?.file_size;
                        break;
                    case 'audio':
                        content = 'Audio received';
                        mediaUrl = message.audio?.url;
                        mediaSize = message.audio?.file_size;
                        break;
                    case 'video':
                        content = message.video?.caption || 'Video received';
                        mediaUrl = message.video?.url;
                        mediaSize = message.video?.file_size;
                        break;
                    default:
                        content = `Received a ${messageType} message`;
                }
                
                // Find or create user
                let user = await User.findOne({ phone: formattedPhone });
                
                if (!user) {
                    // Create new user
                    user = await User.create({
                        phone: formattedPhone,
                        status: 'new',
                        source: 'whatsapp'
                    });
                }
                
                // Find active session or create one if needed
                let session = await UserSession.findOne({
                    userId: user._id,
                    status: 'active'
                }).sort({ lastInteractionAt: -1 });
                
                if (!session) {
                    // Get default workflow for new sessions
                    const defaultWorkflow = await Workflow.findOne({ isActive: true }).sort({ createdAt: 1 });
                    
                    if (!defaultWorkflow) {
                        console.error('No active workflow found. Cannot create session.');
                        return res.sendStatus(200);
                    }
                    
                    // Create new session
                    session = await UserSession.create({
                        userId: user._id,
                        phone: formattedPhone,
                        workflowId: defaultWorkflow._id,
                        adminId: defaultWorkflow.adminId,
                        currentNodeId: defaultWorkflow.startNodeId,
                        status: 'active',
                        source: 'whatsapp',
                        startedAt: new Date(),
                        lastInteractionAt: new Date(),
                        interactionCount: 1
                    });
                } else {
                    // Update session data
                    await UserSession.updateOne(
                        { _id: session._id },
                        { 
                            $set: { lastInteractionAt: new Date() },
                            $inc: { interactionCount: 1 }
                        }
                    );
                }
                
                // Store the message
                const newMessage = await Message.create({
                    sessionId: session._id,
                    userId: user._id,
                    agentId: session.agentId,
                    adminId: session.adminId,
                    campaignId: session.campaignId,
                    sender: 'user',
                    messageType: messageType,
                    content: content,
                    whatsappMessageId: whatsappMessageId,
                    status: 'delivered',
                    mediaUrl: mediaUrl,
                    mediaType: messageType !== 'text' && messageType !== 'interactive' ? messageType : null,
                    mediaName: mediaName,
                    mediaSize: mediaSize,
                    metadata: metadata || null  // Store metadata for interactive messages
                });
                
                // Process workflow if applicable
                if (session.workflowId && session.currentNodeId) {
                    try {
                        const { processWorkflowInput } = require('../services/workflowExecutor');
                        // Pass message type as fourth parameter
                        await processWorkflowInput(session, content, whatsappMessageId, messageType);
                        console.log('Processed workflow input');
                    } catch (workflowError) {
                        console.error('Error processing workflow:', workflowError);
                    }
                }
                
            } else if (value.statuses && value.statuses[0]) {
                // Handle message status updates
                const status = value.statuses[0];
                const statusId = status.id;
                const statusValue = status.status; // delivered, read, etc.
                
                // Update message status in database
                await Message.findOneAndUpdate(
                    { whatsappMessageId: statusId },
                    { 
                        status: statusValue,
                        deliveredAt: statusValue === 'delivered' ? new Date() : undefined,
                        readAt: statusValue === 'read' ? new Date() : undefined
                    }
                );
            }
            
            // Always respond with 200 OK for WhatsApp webhooks
            return res.sendStatus(200);
            
        } catch (error) {
            console.error('Error processing message:', error);
            // Always return 200 to WhatsApp to prevent retries
            return res.sendStatus(200);
        }
    },

    // Verify webhook endpoint for WhatsApp setup
    // In MessageController.js
    verifyWebhook: async (req, res) => {
        try {
            
            // MANUAL QUERY PARSING since req.query is empty
            const url = req.originalUrl || req.url;
            const queryString = url.split('?')[1];
            
            if (!queryString) {
                return res.status(400).send('Bad Request');
            }
            
            // Parse the query string manually
            const params = {};
            queryString.split('&').forEach(param => {
                const [key, value] = param.split('=');
                params[key] = value;
            });
            
            // Get query parameters using manual parsing
            const mode = params['hub.mode'];
            const token = params['hub.verify_token'];
            const challenge = params['hub.challenge'];
            
            // Check if token and mode are in the query
            if (mode && token) {
                // Check if the mode and token sent are correct
                if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
                    // Respond with the challenge token
                    console.log('WEBHOOK_VERIFIED');
                    return res.status(200).send(challenge);
                } else {
                    // Respond with '403 Forbidden' if verify tokens do not match
                    return res.sendStatus(403);
                }
            }
            return res.sendStatus(400);
        } catch (error) {
            return res.status(500).send('Server Error');
        }
    },

    // Mark message as read
    markAsRead: async (req, res) => {
        try {
            const { id } = req.params;

            const message = await Message.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: "Message not found"
                });
            }

            // Check permissions
            if (req.agentId && message.agentId && message.agentId.toString() !== req.agentId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this message"
                });
            }

            message.status = 'read';
            message.readAt = new Date();
            await message.save();

            return res.status(200).json({
                success: true,
                message: "Message marked as read",
                data: message
            });
        } catch (error) {
            console.error("Error in markAsRead:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = MessageController;