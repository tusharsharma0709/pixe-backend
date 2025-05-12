// models/Agents.js
const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: true,
        trim: true
    },
    last_name: {
        type: String,
        required: true,
        trim: true
    },
    mobile: {
        type: String,
        required: true,
        trim: true
    },
    email_id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    role: {
        type: String,
        enum: ['lead_manager', 'customer_support', 'sales', 'verification'],
        default: 'customer_support'
    },
    profile_image: {
        type: String,
        default: null
    },
    status: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    leadCapacity: {
        type: Number,
        default: 20 // Maximum number of active leads an agent can handle
    },
    currentLeadCount: {
        type: Number,
        default: 0
    },
    performance: {
        responseTime: {
            type: Number,
            default: 0 // Average response time in minutes
        },
        conversionRate: {
            type: Number,
            default: 0 // Percentage of leads converted
        },
        customerRating: {
            type: Number,
            default: 0 // Average customer rating (0-5)
        }
    },
    specialization: [{
        type: String // Product categories or skills the agent specializes in
    }],
    deviceToken: {
        type: String, // For push notifications
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
agentSchema.index({ adminId: 1, status: 1 });
agentSchema.index({ adminId: 1, isOnline: 1, currentLeadCount: 1 }); // For load balancing

const Agent = mongoose.model('Agents', agentSchema);
module.exports = { Agent };