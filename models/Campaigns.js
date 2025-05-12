// models/Campaigns.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    facebookCampaignId: {
        type: String,
        required: true
    },
    facebookCampaignUrl: {
        type: String,
        default: null
    },
    campaignDetails: {
        type: Object,
        default: {}
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'inactive'],
        default: 'active'
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        required: true
    },
    originalRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampaignRequests',
        default: null
    },
    activatedAt: {
        type: Date,
        default: Date.now
    },
    pausedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    metrics: {
        impressions: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        leads: {
            type: Number,
            default: 0
        },
        conversions: {
            type: Number,
            default: 0
        },
        spend: {
            type: Number,
            default: 0
        },
        lastSyncedAt: {
            type: Date,
            default: null
        }
    },
    budget: {
        daily: {
            type: Number,
            default: null
        },
        total: {
            type: Number,
            default: null
        },
        currency: {
            type: String,
            default: 'INR'
        }
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    tags: [{
        type: String
    }],
    notes: {
        type: String,
        default: null
    }
}, { 
    timestamps: true 
});

// Add indexes for faster queries
campaignSchema.index({ adminId: 1, status: 1 });
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ facebookCampaignId: 1 });
campaignSchema.index({ originalRequestId: 1 });

const Campaign = mongoose.model('Campaigns', campaignSchema);
module.exports = { Campaign };