// models/UserSessions.js
const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null
    },
    currentNodeId: {
        type: String,
        default: null
    },
    previousNodeId: {
        type: String,
        default: null
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Add these after your existing 'data' field:
    pendingVariableName: {
        type: String,
        default: null
    },
    nextNodeIdAfterInput: {
        type: String,
        default: null
    },
    lastMessageAt: {
        type: Date,
        default: null
    },
    lastMessageType: {
        type: String,
        default: null
    },
    lastMessageSender: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'abandoned', 'transferred'],
        default: 'active'
    },
    stepsCompleted: [{
        type: String
    }],
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    lastInteractionAt: {
        type: Date,
        default: Date.now
    },
    interactionCount: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        enum: ['whatsapp', 'app', 'web', 'agent'],
        default: 'whatsapp'
    },
    sessionTimeout: {
        type: Number,
        default: 3600 // Timeout in seconds (default: 1 hour)
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    sessionNotes: {
        type: String,
        default: null
    },
    transferHistory: [{
        fromAgent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agents'
        },
        toAgent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agents'
        },
        reason: String,
        transferredAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Add indexes for faster queries
userSessionSchema.index({ userId: 1, status: 1 });
userSessionSchema.index({ workflowId: 1, status: 1 });
userSessionSchema.index({ adminId: 1, status: 1 });
userSessionSchema.index({ agentId: 1, status: 1 });
userSessionSchema.index({ lastInteractionAt: -1 });
userSessionSchema.index({ phone: 1, status: 1 });

const UserSession = mongoose.model('UserSessions', userSessionSchema);
module.exports = { UserSession };