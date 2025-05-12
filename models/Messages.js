// models/Messages.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    sender: {
        type: String,
        enum: ['user', 'agent', 'admin', 'system', 'workflow'],
        required: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'document', 'audio', 'video', 'location', 'contact', 'template', 'interactive'],
        default: 'text'
    },
    content: {
        type: String,
        required: true
    },
    metadata: {
        type: Object,
        default: null
    },
    mediaUrl: {
        type: String,
        default: null
    },
    mediaType: {
        type: String,
        default: null
    },
    mediaSize: {
        type: Number,
        default: null
    },
    mediaName: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: String,
        default: null
    },
    readAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    nodeId: {
        type: String,
        default: null // ID of the workflow node that triggered this message
    },
    whatsappMessageId: {
        type: String,
        default: null // ID of the message in WhatsApp system
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ agentId: 1, createdAt: -1 });
messageSchema.index({ adminId: 1, createdAt: -1 });

const Message = mongoose.model('Messages', messageSchema);
module.exports = { Message };