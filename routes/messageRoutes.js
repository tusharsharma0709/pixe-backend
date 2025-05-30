// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageControllers');
const { adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Agent routes
// Send message from agent to user
router.post('/send', adminOrAgentAuth, MessageController.sendMessage);

// Common routes for both admin and agent
// Get messages for a session
router.get('/session/:sessionId', adminOrAgentAuth, MessageController.getSessionMessages);

// Get messages for a user
router.get('/user/:userId', adminOrAgentAuth, MessageController.getUserMessages);

// Mark message as read
router.patch('/:id/read', adminOrAgentAuth, MessageController.markAsRead);

// Webhook route (public, but should be secured with webhook signature verification)
// Receive message from user via WhatsApp webhook
router.post('/webhook/receive', MessageController.receiveMessage);

// Add GET route for webhook verification
router.get('/webhook/receive', 
    // Pass to controller
    MessageController.verifyWebhook
);

// Add GET route for webhook verification
router.get('/recent-chats', 
    adminAuth,
    // Pass to controller
    MessageController.recentChats
);

// Add GET route for webhook verification
router.get('/chats/:id', 
    adminAuth,
    // Pass to controller
    MessageController.getChats
);

module.exports = router;