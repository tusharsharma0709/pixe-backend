// models/CampaignRequests.js - Fixed duplicate index warnings

const mongoose = require('mongoose');

const targetingSchema = new mongoose.Schema({
    ageRange: {
        min: {
            type: Number,
            default: 18,
            min: 13,
            max: 65
        },
        max: {
            type: Number,
            default: 65,
            min: 18,
            max: 65
        }
    },
    gender: {
        type: String,
        enum: ['all', 'male', 'female', 'non_binary'],
        default: 'all'
    },
    locations: [{
        type: String,
        trim: true
    }],
    interests: [{
        type: String,
        trim: true
    }],
    languages: [{
        type: String,
        trim: true
    }],
    excludedAudiences: [{
        type: String,
        trim: true
    }],
    customAudiences: [{
        type: String,
        trim: true
    }],
    behaviors: [{
        type: String,
        trim: true
    }],
    connectionTypes: [{
        type: String,
        enum: ['wifi', 'cellular', 'all']
    }],
    deviceTypes: [{
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'all']
    }]
}, { _id: false });

const budgetScheduleSchema = new mongoose.Schema({
    budgetType: {
        type: String,
        enum: ['daily', 'lifetime', 'weekly'],
        default: 'daily'
    },
    dailyBudget: {
        type: Number,
        required: function() { return this.budgetType === 'daily'; }
    },
    totalBudget: {
        type: Number,
        required: true
    },
    bidStrategy: {
        type: String,
        enum: ['lowest_cost', 'cost_cap', 'bid_cap', 'target_cost'],
        default: 'lowest_cost'
    },
    bidAmount: {
        type: Number,
        default: null
    },
    currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP'],
        default: 'INR'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        default: null
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    }
}, { _id: false });

const creativeSchema = new mongoose.Schema({
    headline: {
        type: String,
        required: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    callToAction: {
        type: String,
        enum: [
            'Learn More', 'Shop Now', 'Sign Up', 'Download', 'Get Quote',
            'Contact Us', 'Apply Now', 'Book Now', 'See Menu', 'Watch More',
            'Play Game', 'Install Now', 'Use App', 'Call Now', 'Message',
            'Subscribe', 'Get Directions', 'Send Message', 'Get Offer'
        ],
        default: 'Learn More'
    },
    primaryText: {
        type: String,
        maxlength: 500,
        default: null
    },
    imageUrls: [{
        type: String,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Image URL must be a valid HTTP/HTTPS URL'
        }
    }],
    videoUrls: [{
        type: String,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Video URL must be a valid HTTP/HTTPS URL'
        }
    }],
    linkUrl: {
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Link URL must be a valid HTTP/HTTPS URL'
        }
    },
    displayLink: {
        type: String,
        maxlength: 50
    }
}, { _id: false });

const campaignRequestSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
        // REMOVED: index: true - will be defined in schema.index() below
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    objective: {
        type: String,
        enum: [
            'awareness',
            'reach', 
            'traffic',
            'engagement',
            'app_installs',
            'video_views',
            'lead_generation',
            'leads',
            'conversions',
            'catalog_sales',
            'store_traffic',
            'messages',
            'brand_awareness',
            'post_engagement'
        ],
        required: true
    },
    platform: {
        type: String,
        enum: ['facebook', 'instagram', 'messenger', 'audience_network', 'whatsapp', 'all_platforms'],
        default: 'facebook'
    },
    adType: {
        type: String,
        enum: [
            'image', 
            'video', 
            'carousel', 
            'collection', 
            'stories', 
            'reels',
            'slideshow',
            'dynamic',
            'playable',
            'instant_experience'
        ],
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
    creatives: {
        type: [creativeSchema],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'At least one creative is required'
        }
    },
    pixelId: {
        type: String,
        default: null,
        trim: true
    },
    catalogId: {
        type: String,
        default: null,
        trim: true
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    status: {
        type: String,
        enum: [
            'draft', 
            'submitted', 
            'under_review', 
            'approved', 
            'rejected', 
            'published',
            'paused',
            'cancelled',
            'expired'
        ],
        default: 'draft'
        // REMOVED: index: true - will be defined in schema.index() below
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    rejectionReason: {
        type: String,
        default: null,
        maxlength: 500
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    superAdminNotes: {
        type: String,
        default: null,
        maxlength: 1000
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
        default: null,
        maxlength: 1000
    },
    // Additional campaign settings
    optimizationGoal: {
        type: String,
        enum: [
            'reach',
            'impressions',
            'clicks',
            'conversions',
            'app_installs',
            'link_clicks',
            'post_engagement',
            'video_views',
            'landing_page_views'
        ],
        default: 'link_clicks'
    },
    attribution: {
        type: String,
        enum: ['1_day_view', '7_day_view', '1_day_click', '7_day_click', '28_day_click'],
        default: '7_day_click'
    },
    // Tracking and analytics
    utmParameters: {
        source: String,
        medium: String,
        campaign: String,
        term: String,
        content: String
    },
    // Delivery settings
    deliveryType: {
        type: String,
        enum: ['standard', 'accelerated'],
        default: 'standard'
    },
    // Compliance and legal
    complianceChecked: {
        type: Boolean,
        default: false
    },
    legalApproval: {
        type: Boolean,
        default: false
    },
    // Internal tracking
    estimatedReach: {
        type: Number,
        default: null
    },
    expectedCPM: {
        type: Number,
        default: null
    },
    expectedCPC: {
        type: Number,
        default: null
    },
    // Versioning
    version: {
        type: Number,
        default: 1
    },
    originalRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampaignRequests',
        default: null
    },
    // Expiry
    expiresAt: {
        type: Date,
        default: function() {
            // Auto-expire draft campaigns after 30 days
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
        // REMOVED: index: true - will be defined in schema.index() below
    }
}, {
    timestamps: true,
    collection: 'campaign_requests'
});

// FIXED: Define all indexes here instead of using index: true on fields
campaignRequestSchema.index({ adminId: 1, status: 1 });
campaignRequestSchema.index({ superAdminId: 1, status: 1 });
campaignRequestSchema.index({ status: 1, createdAt: -1 });
campaignRequestSchema.index({ status: 1, priority: 1 });
campaignRequestSchema.index({ workflowId: 1 });
campaignRequestSchema.index({ publishedCampaignId: 1 });
campaignRequestSchema.index({ originalRequestId: 1 });
campaignRequestSchema.index({ expiresAt: 1 }); // TTL index - moved from field definition

// Virtual for estimated budget per day
campaignRequestSchema.virtual('estimatedDailyBudget').get(function() {
    if (this.budgetSchedule && this.budgetSchedule.budgetType === 'daily') {
        return this.budgetSchedule.dailyBudget;
    }
    
    if (this.budgetSchedule && this.budgetSchedule.startDate && this.budgetSchedule.endDate) {
        const days = Math.ceil((this.budgetSchedule.endDate - this.budgetSchedule.startDate) / (1000 * 60 * 60 * 24));
        return days > 0 ? this.budgetSchedule.totalBudget / days : 0;
    }
    
    return 0;
});

// Virtual for campaign duration
campaignRequestSchema.virtual('campaignDuration').get(function() {
    if (this.budgetSchedule && this.budgetSchedule.startDate && this.budgetSchedule.endDate) {
        return Math.ceil((this.budgetSchedule.endDate - this.budgetSchedule.startDate) / (1000 * 60 * 60 * 24));
    }
    return null;
});

// Pre-save middleware to validate budget
campaignRequestSchema.pre('save', function(next) {
    if (this.budgetSchedule) {
        // Ensure daily budget doesn't exceed total budget
        if (this.budgetSchedule.budgetType === 'daily' && this.budgetSchedule.dailyBudget > this.budgetSchedule.totalBudget) {
            next(new Error('Daily budget cannot exceed total budget'));
            return;
        }
        
        // Ensure start date is not in the past (except for drafts)
        if (this.status !== 'draft' && this.budgetSchedule.startDate < new Date()) {
            next(new Error('Campaign start date cannot be in the past'));
            return;
        }
        
        // Ensure end date is after start date
        if (this.budgetSchedule.endDate && this.budgetSchedule.endDate <= this.budgetSchedule.startDate) {
            next(new Error('Campaign end date must be after start date'));
            return;
        }
    }
    
    next();
});

// Static method to get campaigns by status
campaignRequestSchema.statics.getByStatus = function(status, adminId = null) {
    const query = { status };
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name email_id business_name')
        .populate('superAdminId', 'first_name last_name')
        .populate('workflowId', 'name description')
        .populate('publishedCampaignId', 'name status facebookCampaignId')
        .sort({ createdAt: -1 });
};

// Static method to get pending approvals
campaignRequestSchema.statics.getPendingApprovals = function() {
    return this.find({ status: { $in: ['submitted', 'under_review'] } })
        .populate('adminId', 'first_name last_name email_id business_name')
        .sort({ createdAt: 1 }); // Oldest first for FIFO processing
};

const CampaignRequest = mongoose.model('CampaignRequests', campaignRequestSchema);
module.exports = { CampaignRequest };