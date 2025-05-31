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
const { Workflow } = require('../models/Workflows');
const { Verification } = require('../models/Verifications');
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
// const sendWhatsAppMessage = async (phoneNumber, message, messageType = 'text', mediaUrl = null) => {
//     try {
//         // This would integrate with WhatsApp Business API
//         // For now, it's a placeholder function
//         const apiUrl =`https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
//         const accessToken = process.env.WHATSAPP_API_TOKEN;
        
//         const payload = {
//             messaging_product: "whatsapp",
//             to: phoneNumber,
//             type: messageType
//         };

//         if (messageType === 'text') {
//             payload.text = { body: message };
//         } else if (messageType === 'image') {
//             payload.image = { link: mediaUrl, caption: message };
//         } else if (messageType === 'document') {
//             payload.document = { link: mediaUrl, caption: message };
//         }

//         const response = await axios.post(apiUrl, payload, {
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         return { success: true, data: response.data };
//     } catch (error) {
//         console.error("Error sending WhatsApp message:", error);
//         return { success: false, error: error.message };
//     }
// };
const { sendWhatsAppMessage } = require('../services/whatsappServices'); // Import your service

const MessageController = {

    sendMessage: async (req, res) => {
        try {
            const {
                userId,
                sessionId,
                content,
                messageType = 'text',
                mediaUrl,
                buttons,  // For interactive messages
                metadata
            } = req.body;

            const agentId = req.agentId;
            const adminId = req.adminId;

            console.log(`\n📨 MESSAGE SEND REQUEST`);
            console.log(`  User ID: ${userId}`);
            console.log(`  Session ID: ${sessionId}`);
            console.log(`  Message Type: ${messageType}`);
            console.log(`  Content: "${content}"`);
            console.log(`  Requester: ${agentId ? 'Agent' : 'Admin'}`);

            // Validate required fields
            if (!userId || !content) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and content are required"
                });
            }

            // Validate message type specific requirements
            if (['image', 'document', 'video'].includes(messageType) && !mediaUrl) {
                return res.status(400).json({
                    success: false,
                    message: `Media URL is required for ${messageType} messages`
                });
            }

            if (['interactive', 'buttons'].includes(messageType) && (!buttons || !Array.isArray(buttons) || buttons.length === 0)) {
                return res.status(400).json({
                    success: false,
                    message: "Buttons array is required for interactive messages"
                });
            }

            // Determine sender type based on authentication
            let senderType, senderId, senderName = null;

            if (agentId) {
                senderType = 'agent';
                senderId = agentId;

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

                // Get agent details
                const agent = await Agent.findById(agentId);
                if (agent) {
                    senderName = `${agent.first_name} ${agent.last_name}`;
                }

            } else if (adminId) {
                senderType = 'admin';
                senderId = adminId;
                // Admin can message any user - no additional permission check needed

                // Get admin details
                const admin = await Admin.findById(adminId);
                if (admin) {
                    senderName = admin.name || admin.email || 'Admin';
                }

            } else {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required - must be agent or admin"
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

            // Validate user has phone number
            if (!user.phone) {
                return res.status(400).json({
                    success: false,
                    message: "User phone number not found - cannot send WhatsApp message"
                });
            }

            // Get or create session
            let session = null;
            if (sessionId) {
                session = await UserSession.findById(sessionId);
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        message: "Session not found"
                    });
                }
            } else {
                // Find active session for this user
                session = await UserSession.findOne({
                    userId,
                    status: 'active'
                }).sort({ createdAt: -1 });

                if (!session) {
                    return res.status(404).json({
                        success: false,
                        message: "No active session found for this user"
                    });
                }
            }

            console.log(`\n📞 PREPARING WHATSAPP MESSAGE`);
            console.log(`  Recipient: ${user.fullName || user.phone}`);
            console.log(`  Phone: ${user.phone}`);
            console.log(`  Type: ${messageType}`);
            console.log(`  Sender: ${senderName || senderType}`);

            // 🔥 SEND WHATSAPP MESSAGE USING YOUR SERVICE
            const whatsappResult = await sendWhatsAppMessage(
                user.phone,     // Phone number
                content,        // Message content
                messageType,    // Message type (text, image, document, video, interactive)
                mediaUrl,       // Media URL (for media messages)
                buttons         // Buttons (for interactive messages)
            );

            console.log(`📱 WhatsApp API Result:`, {
                success: whatsappResult.success,
                messageId: whatsappResult.messageId,
                error: whatsappResult.error
            });

            // Check if WhatsApp message failed
            if (!whatsappResult.success) {
                console.error(`❌ WhatsApp message failed:`, whatsappResult.error);
                
                // Still log the attempt in activity logs
                try {
                    await ActivityLog.logActivity({
                        actorId: senderId,
                        actorModel: senderType === 'agent' ? 'Agents' : 'Admins',
                        actorName: senderName || `${senderType} user`,
                        action: 'message_failed',
                        entityType: 'Message',
                        entityId: null,
                        description: `Failed to send ${messageType} message to user ${user.fullName || user.phone}: ${whatsappResult.error}`,
                        adminId: session.adminId,
                        status: 'failure',
                        category: 'communication',
                        priority: 'medium',
                        errorDetails: {
                            message: whatsappResult.error,
                            details: whatsappResult.details
                        }
                    });
                } catch (logError) {
                    console.error("Error logging failed message activity:", logError);
                }

                return res.status(500).json({
                    success: false,
                    message: "Failed to send WhatsApp message",
                    error: whatsappResult.error,
                    details: whatsappResult.details
                });
            }

            // Create message record in database
            const messageData = {
                sessionId: session._id,
                userId,
                sender: senderType,
                messageType,
                content,
                metadata: {
                    ...metadata,
                    whatsappMessageId: whatsappResult.messageId,
                    whatsappResponse: whatsappResult.data,
                    sentAt: new Date(),
                    senderName: senderName
                },
                mediaUrl,
                mediaType: messageType,
                status: 'sent',
                whatsappMessageId: whatsappResult.messageId
            };

            // Add buttons for interactive messages
            if (['interactive', 'buttons'].includes(messageType) && buttons) {
                messageData.buttons = buttons;
                messageData.metadata.buttonCount = buttons.length;
            }

            // Add sender-specific fields
            if (senderType === 'agent') {
                messageData.agentId = senderId;
                messageData.adminId = session.adminId;
                messageData.campaignId = session.campaignId;
            } else if (senderType === 'admin') {
                messageData.adminId = senderId;
                messageData.campaignId = session.campaignId;
            }

            const message = new Message(messageData);
            await message.save();

            console.log(`💾 Message saved to database:`, {
                messageId: message._id,
                whatsappId: whatsappResult.messageId
            });

            // Update session activity
            session.lastInteractionAt = new Date();
            session.interactionCount += 1;
            session.lastMessageAt = new Date();
            session.lastMessageType = messageType;
            session.lastMessageSender = senderType;
            await session.save();

            // Log successful activity
            try {
                await ActivityLog.logActivity({
                    actorId: senderId,
                    actorModel: senderType === 'agent' ? 'Agents' : 'Admins',
                    actorName: senderName || `${senderType} user`,
                    action: 'message_sent',
                    entityType: 'Message',
                    entityId: message._id,
                    description: `${senderType.charAt(0).toUpperCase() + senderType.slice(1)} sent ${messageType} message to user ${user.fullName || user.phone}`,
                    adminId: session.adminId,
                    userId: userId,
                    sessionId: session._id.toString(),
                    status: 'success',
                    category: 'communication',
                    priority: 'low',
                    metadata: {
                        messageType: messageType,
                        contentLength: content.length,
                        whatsappMessageId: whatsappResult.messageId,
                        hasMedia: !!mediaUrl,
                        hasButtons: !!buttons,
                        recipientPhone: user.phone
                    }
                });

                console.log(`📝 Activity logged successfully`);
            } catch (activityError) {
                console.error("❌ Error logging message activity:", activityError.message);
                // Don't throw error - just log it and continue
            }

            console.log(`✅ MESSAGE SENT SUCCESSFULLY`);
            console.log(`  Message ID: ${message._id}`);
            console.log(`  WhatsApp ID: ${whatsappResult.messageId}`);
            console.log(`  Recipient: ${user.fullName || user.phone}`);

            return res.status(201).json({
                success: true,
                message: "Message sent successfully",
                data: {
                    ...message.toObject(),
                    senderType,
                    senderName: senderName || `${senderType} user`,
                    whatsappMessageId: whatsappResult.messageId,
                    whatsappStatus: 'sent',
                    recipient: {
                        userId: user._id,
                        name: user.fullName,
                        phone: user.phone
                    },
                    session: {
                        sessionId: session._id,
                        workflowName: session.workflowName,
                        currentStep: session.currentStep
                    }
                }
            });

        } catch (error) {
            console.error("❌ CRITICAL ERROR in sendMessage:", error);

            // Log critical error activity
            try {
                await ActivityLog.logActivity({
                    actorId: req.agentId || req.adminId,
                    actorModel: req.agentId ? 'Agents' : 'Admins',
                    actorName: 'System Error',
                    action: 'message_failed',
                    entityType: 'Message',
                    entityId: null,
                    description: `Critical error while sending message: ${error.message}`,
                    adminId: req.adminId,
                    status: 'error',
                    category: 'communication',
                    priority: 'critical',
                    errorDetails: {
                        message: error.message,
                        stack: error.stack,
                        code: error.code || 'UNKNOWN_ERROR'
                    }
                });
            } catch (logError) {
                console.error("Error logging critical error:", logError);
            }

            return res.status(500).json({
                success: false,
                message: "Internal server error while sending message",
                error: error.message
            });
        }
    },

    recentChats: async (req, res) => {
        try {
            const  adminId  = req.adminId;
            console.log(adminId)
            const { page = 1, limit = 20 } = req.query;
    
            // Aggregate pipeline to get the most recent message from each user
            const recentChats = await Message.aggregate([
                {
                    // Match messages where admin is involved (either as sender or recipient)
                    $match: {
                        $or: [
                            { adminId: new mongoose.Types.ObjectId(adminId) },
                            { sender: 'admin', adminId: new mongoose.Types.ObjectId(adminId) }
                        ],
                        isDeleted: false
                    }
                },
                {
                    // Sort by creation time (newest first) to get recent messages first
                    $sort: { createdAt: -1 }
                },
                {
                    // Group by userId to get the most recent message per user
                    $group: {
                        _id: '$userId',
                        lastMessage: { $first: '$$ROOT' },
                        unreadCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ['$sender', 'admin'] },
                                            { $eq: ['$status', 'delivered'] },
                                            { $eq: ['$readAt', null] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                },
                {
                    // Sort by last message time (newest conversations first)
                    $sort: { 'lastMessage.createdAt': -1 }
                },
                {
                    // Pagination
                    $skip: (page - 1) * parseInt(limit)
                },
                {
                    $limit: parseInt(limit)
                },
                {
                    // Populate user details
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    // Populate session details
                    $lookup: {
                        from: 'usersessions',
                        localField: 'lastMessage.sessionId',
                        foreignField: '_id',
                        as: 'session'
                    }
                },
                {
                    // Project the final structure
                    $project: {
                        _id: 0,
                        userId: '$_id',
                        user: { $arrayElemAt: ['$user', 0] },
                        session: { $arrayElemAt: ['$session', 0] },
                        lastMessage: {
                            _id: '$lastMessage._id',
                            content: '$lastMessage.content',
                            messageType: '$lastMessage.messageType',
                            sender: '$lastMessage.sender',
                            status: '$lastMessage.status',
                            createdAt: '$lastMessage.createdAt',
                            mediaUrl: '$lastMessage.mediaUrl',
                            mediaType: '$lastMessage.mediaType'
                        },
                        unreadCount: 1
                    }
                }
            ]);
    
            // Get total count for pagination
            const totalCount = await Message.aggregate([
                {
                    $match: {
                        $or: [
                            { adminId: new mongoose.Types.ObjectId(adminId) },
                            { sender: 'admin', adminId: new mongoose.Types.ObjectId(adminId) }
                        ],
                        isDeleted: false
                    }
                },
                {
                    $group: {
                        _id: '$userId'
                    }
                },
                {
                    $count: 'total'
                }
            ]);
    
            const total = totalCount.length > 0 ? totalCount[0].total : 0;
    
            res.status(200).json({
                success: true,
                data: recentChats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
    
        } catch (error) {
            console.error('Error fetching recent chats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recent chats',
                error: error.message
            });
        }
    },

    getChats: async (req, res) => {
        try {
            const adminId = req.adminId;
            const userId  = req.params.id;
            const { page = 1, limit = 50, sessionId } = req.query;
    
            // Build the match query
            let matchQuery = {
                userId: new mongoose.Types.ObjectId(userId),
                isDeleted: false,
                $or: [
                    { adminId: new mongoose.Types.ObjectId(adminId) },
                    { sender: 'admin', adminId: new mongoose.Types.ObjectId(adminId) },
                    { sender: 'user' } // Include user messages in the conversation
                ]
            };
    
            // If sessionId is provided, filter by session
            if (sessionId) {
                matchQuery.sessionId = new mongoose.Types.ObjectId(sessionId);
            }
    
            // Get messages with pagination (newest first, but reverse for chat display)
            const messages = await Message.find(matchQuery)
                .populate('userId', 'name email phone profilePicture')
                .populate('adminId', 'name email')
                .populate('sessionId', 'sessionType status startTime endTime')
                .sort({ createdAt: -1 }) // Newest first for pagination
                .skip((page - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean();
    
            // Reverse the array to show oldest to newest (typical chat order)
            const sortedMessages = messages.reverse();
    
            // Get total count
            const totalCount = await Message.countDocuments(matchQuery);
    
            // Mark messages as read (optional - update read status)
            await Message.updateMany(
                {
                    userId: new mongoose.Types.ObjectId(userId),
                    sender: 'user',
                    status: 'delivered',
                    readAt: null
                },
                {
                    status: 'read',
                    readAt: new Date()
                }
            );
    
            res.status(200).json({
                success: true,
                data: sortedMessages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / parseInt(limit)),
                    hasMore: (page * limit) < totalCount
                }
            });
    
        } catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch messages',
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
            console.log('\n📥 WEBHOOK RECEIVED');
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            
            // WhatsApp sends data in this specific format
            const { entry } = req.body;
            
            // Validate webhook structure
            if (!entry || !Array.isArray(entry) || !entry[0] || !entry[0].changes) {
                console.log('⚠️ Invalid webhook structure - ignoring');
                return res.sendStatus(200);
            }
            
            const changes = entry[0].changes[0];
            const value = changes.value;
            
            // Log what type of webhook this is
            if (value.messages) {
                console.log('📨 Processing incoming message');
            } else if (value.statuses) {
                console.log('📋 Processing status update');
            } else {
                console.log('🔄 Unknown webhook type - ignoring');
                return res.sendStatus(200);
            }
            
            // Handle different types of webhooks (messages, statuses, etc.)
            if (value.messages && value.messages[0]) {
                // Handle incoming message
                const message = value.messages[0];
                const phoneNumber = message.from; // Format: 919302239283 (without +)
                const whatsappMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000); // Convert Unix timestamp
                
                // Validate required fields
                if (!phoneNumber || !whatsappMessageId) {
                    console.error('❌ Missing required fields: phoneNumber or messageId');
                    return res.sendStatus(200);
                }
                
                // Format phone number consistently
                const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
                
                console.log(`📱 Message from: ${formattedPhone}`);
                console.log(`🆔 WhatsApp ID: ${whatsappMessageId}`);
                
                // Check for duplicate messages
                const existingMessage = await Message.findOne({ whatsappMessageId });
                if (existingMessage) {
                    console.log('⚠️ Duplicate message detected - ignoring');
                    return res.sendStatus(200);
                }
                
                // Process message based on type
                let content, messageType, mediaUrl, mediaName, mediaSize, metadata = {};
                
                // Determine message type
                messageType = message.type || 'text';
                console.log(`📝 Message type: ${messageType}`);
                
                switch (messageType) {
                    case 'text':
                        content = message.text?.body || '';
                        console.log(`💬 Text content: "${content}"`);
                        break;
                        
                    case 'interactive':
                        // Handle interactive message responses (buttons, lists)
                        if (message.interactive.type === 'button_reply') {
                            const buttonReply = message.interactive.button_reply;
                            content = buttonReply.id; // Use button ID as content
                            metadata = {
                                buttonTitle: buttonReply.title,
                                buttonId: buttonReply.id,
                                interactiveType: 'button',
                                originalContent: buttonReply.title // Also store the display text
                            };
                            console.log(`🔘 Button response: ID=${buttonReply.id}, Title=${buttonReply.title}`);
                        } 
                        else if (message.interactive.type === 'list_reply') {
                            const listReply = message.interactive.list_reply;
                            content = listReply.id; // Use list item ID as content
                            metadata = {
                                listItemTitle: listReply.title,
                                listItemId: listReply.id,
                                listItemDescription: listReply.description,
                                interactiveType: 'list',
                                originalContent: listReply.title
                            };
                            console.log(`📋 List response: ID=${listReply.id}, Title=${listReply.title}`);
                        } 
                        else {
                            content = `Received interactive message of type: ${message.interactive.type}`;
                            metadata = { 
                                interactiveType: message.interactive.type,
                                rawInteractive: message.interactive
                            };
                            console.log(`🔄 Other interactive type: ${message.interactive.type}`);
                        }
                        break;
                        
                    case 'image':
                        content = message.image?.caption || 'Image received';
                        mediaUrl = null; // Will be handled separately if needed
                        metadata = {
                            whatsappMediaId: message.image?.id,
                            mimeType: message.image?.mime_type,
                            sha256: message.image?.sha256
                        };
                        console.log(`🖼️ Image received: ${content}`);
                        break;
                        
                    case 'document':
                        content = message.document?.caption || 'Document received';
                        mediaUrl = null; // Will be handled separately if needed
                        mediaName = message.document?.filename;
                        mediaSize = message.document?.file_size;
                        metadata = {
                            whatsappMediaId: message.document?.id,
                            mimeType: message.document?.mime_type,
                            sha256: message.document?.sha256
                        };
                        console.log(`📄 Document received: ${mediaName}`);
                        break;
                        
                    case 'audio':
                        content = 'Audio received';
                        mediaUrl = null; // Will be handled separately if needed
                        mediaSize = message.audio?.file_size;
                        metadata = {
                            whatsappMediaId: message.audio?.id,
                            mimeType: message.audio?.mime_type,
                            sha256: message.audio?.sha256,
                            voiceMessage: message.audio?.voice || false
                        };
                        console.log(`🎵 Audio received`);
                        break;
                        
                    case 'video':
                        content = message.video?.caption || 'Video received';
                        mediaUrl = null; // Will be handled separately if needed
                        mediaSize = message.video?.file_size;
                        metadata = {
                            whatsappMediaId: message.video?.id,
                            mimeType: message.video?.mime_type,
                            sha256: message.video?.sha256
                        };
                        console.log(`🎥 Video received: ${content}`);
                        break;
                        
                    case 'location':
                        const location = message.location;
                        content = `Location: ${location.name || 'Shared location'}`;
                        metadata = {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            name: location.name,
                            address: location.address
                        };
                        console.log(`📍 Location received: ${location.latitude}, ${location.longitude}`);
                        break;
                        
                    case 'contacts':
                        content = `Contact shared: ${message.contacts[0]?.name?.formatted_name || 'Unknown'}`;
                        metadata = {
                            contacts: message.contacts
                        };
                        console.log(`👤 Contact shared`);
                        break;
                        
                    default:
                        content = `Received a ${messageType} message`;
                        metadata = { rawMessage: message };
                        console.log(`❓ Unknown message type: ${messageType}`);
                }
                
                // Find or create user
                let user = await User.findOne({ phone: formattedPhone });
                
                if (!user) {
                    console.log(`👤 Creating new user for ${formattedPhone}`);
                    // Create new user with more details if available
                    const profile = value.contacts?.[0]?.profile;
                    user = await User.create({
                        phone: formattedPhone,
                        fullName: profile?.name || null,
                        status: 'new',
                        source: 'whatsapp',
                        whatsappProfile: profile || null,
                        firstMessageAt: timestamp
                    });
                    console.log(`✅ User created: ${user._id}`);
                } else {
                    console.log(`👤 Found existing user: ${user._id}`);
                    // Update last interaction
                    await User.updateOne(
                        { _id: user._id },
                        { $set: { lastInteractionAt: timestamp } }
                    );
                }
                
                // Import Workflow model
                const { Workflow } = require('../models/Workflows');
                
                // Find active session or create one if needed
                let session = await UserSession.findOne({
                    userId: user._id,
                    status: 'active'
                }).sort({ lastInteractionAt: -1 });
                
                if (!session) {
                    console.log(`📋 Creating new session for user ${user._id}`);
                    
                    // Get default workflow for new sessions
                    const defaultWorkflow = await Workflow.findOne({ 
                        isActive: true,
                        isDeleted: { $ne: true }
                    }).sort({ createdAt: 1 });
                    
                    if (!defaultWorkflow) {
                        console.error('❌ No active workflow found. Cannot create session.');
                        // Store message without session
                        await Message.create({
                            userId: user._id,
                            sender: 'user',
                            messageType: messageType,
                            content: content,
                            whatsappMessageId: whatsappMessageId,
                            status: 'delivered',
                            mediaUrl: mediaUrl,
                            mediaType: messageType !== 'text' && messageType !== 'interactive' ? messageType : null,
                            mediaName: mediaName,
                            mediaSize: mediaSize,
                            metadata: metadata,
                            receivedAt: timestamp,
                            processedAt: new Date()
                        });
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
                        startedAt: timestamp,
                        lastInteractionAt: timestamp,
                        interactionCount: 1
                    });
                    console.log(`✅ Session created: ${session._id}`);
                } else {
                    console.log(`📋 Found existing session: ${session._id}`);
                    // Update session data
                    await UserSession.updateOne(
                        { _id: session._id },
                        { 
                            $set: { lastInteractionAt: timestamp },
                            $inc: { interactionCount: 1 }
                        }
                    );
                }
                
                // Store the message
                console.log(`💾 Storing message in database`);
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
                    metadata: metadata,
                    receivedAt: timestamp,
                    processedAt: new Date()
                });
                
                console.log(`✅ Message stored: ${newMessage._id}`);
                
                // Log activity for message received
                try {
                    await logActivity({
                        actorId: user._id,
                        actorModel: 'Users',
                        actorName: user.fullName || user.phone,
                        action: 'message_received',
                        entityType: 'Message',
                        entityId: newMessage._id,
                        description: `User sent ${messageType} message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                        adminId: session.adminId,
                        userId: user._id,
                        metadata: {
                            messageType,
                            whatsappMessageId,
                            sessionId: session._id
                        }
                    });
                } catch (activityError) {
                    console.error("Error logging message received activity:", activityError.message);
                }
                
                // Process workflow if applicable
                if (session.workflowId && session.currentNodeId) {
                    try {
                        console.log(`🔄 Processing workflow input`);
                        await processWorkflowInput(session, content, whatsappMessageId, messageType);
                        console.log('✅ Workflow input processed successfully');
                    } catch (workflowError) {
                        console.error('❌ Error processing workflow:', workflowError);
                        
                        // Log workflow error activity
                        try {
                            await logActivity({
                                actorId: session.adminId || user._id,
                                actorModel: session.adminId ? 'Admins' : 'Users',
                                actorName: 'System',
                                action: 'workflow_failed',
                                entityType: 'Session',
                                entityId: session._id,
                                description: `Workflow processing failed for message: ${workflowError.message}`,
                                adminId: session.adminId,
                                userId: user._id,
                                status: 'error',
                                errorDetails: {
                                    message: workflowError.message,
                                    code: workflowError.code || 'WORKFLOW_ERROR'
                                }
                            });
                        } catch (logError) {
                            console.error("Error logging workflow failure:", logError.message);
                        }
                    }
                }
                
            } else if (value.statuses && value.statuses[0]) {
                // Handle message status updates
                console.log(`📊 Processing status update`);
                const status = value.statuses[0];
                const statusId = status.id;
                const statusValue = status.status; // delivered, read, sent, failed
                const timestamp = new Date(parseInt(status.timestamp) * 1000);
                
                console.log(`📋 Status: ${statusValue} for message: ${statusId}`);
                
                // Update message status in database
                const updateData = { 
                    status: statusValue,
                    processedAt: new Date()
                };
                
                // Add specific timestamps based on status
                switch (statusValue) {
                    case 'sent':
                        updateData.sentAt = timestamp;
                        break;
                    case 'delivered':
                        updateData.deliveredAt = timestamp;
                        break;
                    case 'read':
                        updateData.readAt = timestamp;
                        break;
                    case 'failed':
                        updateData.failedAt = timestamp;
                        updateData.errorDetails = status.errors || null;
                        break;
                }
                
                const updatedMessage = await Message.findOneAndUpdate(
                    { whatsappMessageId: statusId },
                    updateData,
                    { new: true }
                );
                
                if (updatedMessage) {
                    console.log(`✅ Message status updated: ${statusId} → ${statusValue}`);
                } else {
                    console.log(`⚠️ Message not found for status update: ${statusId}`);
                }
            }
            
            // Always respond with 200 OK for WhatsApp webhooks
            console.log(`✅ Webhook processed successfully`);
            return res.sendStatus(200);
            
        } catch (error) {
            console.error('❌ Error processing webhook:', error);
            
            // Log critical error activity
            try {
                await logActivity({
                    actorId: new mongoose.Types.ObjectId(), // System actor
                    actorModel: 'System',
                    actorName: 'WhatsApp Webhook System',
                    action: 'system_error',
                    entityType: 'System',
                    description: `WhatsApp webhook processing failed: ${error.message}`,
                    status: 'error',
                    priority: 'critical',
                    errorDetails: {
                        message: error.message,
                        stack: error.stack,
                        code: 'WEBHOOK_ERROR'
                    },
                    metadata: {
                        requestBody: req.body,
                        timestamp: new Date()
                    }
                });
            } catch (logError) {
                console.error("Error logging system error:", logError.message);
            }
            
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