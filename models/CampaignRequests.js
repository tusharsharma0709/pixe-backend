// models/CampaignRequests.js
const mongoose = require('mongoose');

const targetingSchema = new mongoose.Schema({
    ageRange: {
        min: {
            type: Number,
            default: 18
        },
        max: {
            type: Number,
            default: 65
        }
    },
    gender: {
        type: String,
        enum: ['all', 'male', 'female'],
        default: 'all'
    },
    locations: [{
        type: String
    }],
    interests: [{
        type: String
    }],
    languages: [{
        type: String
    }],
    excludedAudiences: [{
        type: String
    }],
    customAudiences: [{
        type: String
    }]
}, { _id: false });

const budgetScheduleSchema = new mongoose.Schema({
    dailyBudget: {
        type: Number,
        required: true
    },
    totalBudget: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        default: null
    }
}, { _id: false });

const creativeSchema = new mongoose.Schema({
    headline: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    callToAction: {
        type: String,
        default: 'Learn More'
    },
    primaryText: {
        type: String,
        default: null
    },
    imageUrls: [{
        type: String
    }],
    videoUrls: [{
        type: String
    }]
}, { _id: false });

const campaignRequestSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    objective: {
        type: String,
        enum: ['awareness', 'traffic', 'engagement', 'leads', 'app_installs', 'conversions', 'catalog_sales', 'messages'],
        required: true
    },
    platform: {
        type: String,
        enum: ['facebook', 'instagram', 'messenger', 'audience_network', 'whatsapp'],
        default: 'facebook'
    },
    adType: {
        type: String,
        enum: ['image', 'video', 'carousel', 'collection', 'stories'],
        required: true
    },
    targeting: {
        type: targetingSchema,
        default: () => ({})
    },
    budgetSchedule: {
        type: budgetScheduleSchema,
        required: true
    },
    creatives: [creativeSchema],
    pixelId: {
        type: String,
        default: null
    },
    catalogId: {
        type: String,
        default: null
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'published'],
        default: 'draft'
    },
    rejectionReason: {
        type: String,
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    superAdminNotes: {
        type: String,
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    publishedCampaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
campaignRequestSchema.index({ adminId: 1, status: 1 });
campaignRequestSchema.index({ superAdminId: 1, status: 1 });
campaignRequestSchema.index({ status: 1, createdAt: -1 });

const CampaignRequest = mongoose.model('CampaignRequests', campaignRequestSchema);
module.exports = { CampaignRequest };