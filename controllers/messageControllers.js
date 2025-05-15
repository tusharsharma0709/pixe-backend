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

    // Update your receiveMessage in MessageController.js to handle WhatsApp webhook format:
// Update receiveMessage in MessageController.js
receiveMessage: async (req, res) => {
    try {
        console.log('\n=== WhatsApp Webhook Received ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        
        // WhatsApp sends data in this specific format
        const { entry } = req.body;
        
        if (!entry || !entry[0] || !entry[0].changes) {
            console.log('No changes in webhook, returning 200');
            return res.sendStatus(200);
        }
        
        const changes = entry[0].changes[0];
        const value = changes.value;
        
        // Handle different types of webhooks (messages, statuses, etc.)
        if (!value.messages || !value.messages[0]) {
            console.log('No messages in webhook, returning 200');
            return res.sendStatus(200);
        }
        
        const message = value.messages[0];
        const phoneNumber = message.from; // Format: 919302239283 (without +)
        const messageText = message.text?.body;
        const whatsappMessageId = message.id;
        
        console.log('From:', phoneNumber);
        console.log('Message:', messageText);
        console.log('Message ID:', whatsappMessageId);
        
        // Add + to phone number for database lookup
        const formattedPhone = `+${phoneNumber}`;
        
        // Find user by phone number
        const user = await User.findOne({ phone: formattedPhone });
        if (!user) {
            console.error('User not found for phone:', formattedPhone);
            return res.sendStatus(200);
        }
        
        // Find active session
        const session = await UserSession.findOne({
            userId: user._id,
            status: 'active'
        }).sort({ createdAt: -1 });

        if (!session) {
            console.error('No active session found for user:', user._id);
            return res.sendStatus(200);
        }
        
        console.log('Found session:', session._id);
        console.log('Current node:', session.currentNodeId);
        
        // Create message record
        const newMessage = new Message({
            sessionId: session._id,
            userId: user._id,
            agentId: session.agentId,
            adminId: session.adminId,
            campaignId: session.campaignId,
            sender: 'user',
            messageType: 'text',
            content: messageText,
            status: 'delivered',
            whatsappMessageId
        });

        await newMessage.save();
        
        // Update session activity
        session.lastInteractionAt = new Date();
        session.interactionCount += 1;
        await session.save();
        
        // Process workflow if applicable
        if (session.workflowId && session.currentNodeId) {
            console.log('Processing workflow input...');
            const { processWorkflowInput } = require('../services/workflowExecutor');
            await processWorkflowInput(session, messageText);
        }
        
        // Always return 200 to WhatsApp
        res.sendStatus(200);
        
    } catch (error) {
        console.error("Error in receiveMessage:", error);
        // Still return 200 to prevent WhatsApp retries
        res.sendStatus(200);
    }
},

    // Add this new method to MessageController
// Replace the verifyWebhook method in MessageController.js with this:
verifyWebhook: async (req, res) => {
    try {
        console.log('\n=== Webhook Verification Request ===');
        console.log('Query params:', req.query);
        console.log('Headers:', req.headers);
        
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        console.log('Mode:', mode);
        console.log('Received Token:', token);
        console.log('Challenge:', challenge);
        console.log('Expected Token:', 'my_custom_verify_token');
        
        // Check if this is a subscribe event
        if (mode === 'subscribe') {
            // Check if the token matches
            if (token === 'my_custom_verify_token') {
                console.log('Token matches! Sending challenge back');
                // Return the challenge value
                return res.status(200).send(challenge);
            } else {
                console.log('Token mismatch!');
                console.log('Expected: my_custom_verify_token');
                console.log('Received:', token);
                return res.status(403).send('Forbidden');
            }
        } else {
            console.log('Not a subscribe event');
            return res.status(403).send('Forbidden');
        }
    } catch (error) {
        console.error('Error in webhook verification:', error);
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