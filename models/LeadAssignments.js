// models/LeadAssignments.js
const mongoose = require('mongoose');

const leadAssignmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'transferred', 'inactive'],
        default: 'active'
    },
    assignmentType: {
        type: String,
        enum: ['automatic', 'manual', 'round_robin', 'performance_based'],
        default: 'automatic'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    notes: {
        type: String,
        default: null
    },
    initialUserStatus: {
        type: String,
        default: null
    },
    userStatusAtCompletion: {
        type: String,
        default: null
    },
    completionReason: {
        type: String,
        enum: [
            'converted', 
            'rejected', 
            'timeout', 
            'transferred', 
            'customer_inactive', 
            'admin_decision'
        ],
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
        transferReason: String,
        transferredAt: {
            type: Date,
            default: Date.now
        },
        transferredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admins'
        }
    }],
    performance: {
        responseTime: {
            type: Number,
            default: null // Average response time in minutes
        },
        interactionCount: {
            type: Number,
            default: 0
        },
        outcome: {
            type: String,
            enum: ['pending', 'success', 'failure'],
            default: 'pending'
        }
    },
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
    isAutoAssigned: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
leadAssignmentSchema.index({ userId: 1, status: 1 });
leadAssignmentSchema.index({ agentId: 1, status: 1 });
leadAssignmentSchema.index({ adminId: 1, status: 1 });
leadAssignmentSchema.index({ status: 1, lastInteractionAt: -1 });
leadAssignmentSchema.index({ assignedBy: 1, createdAt: -1 });

const LeadAssignment = mongoose.model('LeadAssignments', leadAssignmentSchema);
module.exports = { LeadAssignment };