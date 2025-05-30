// models/Campaigns.js - Updated with comprehensive enum values
const mongoose = require('mongoose');

const metricsSchema = new mongoose.Schema({
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
    reach: {
        type: Number,
        default: 0
    },
    frequency: {
        type: Number,
        default: 0
    },
    cpm: {
        type: Number,
        default: 0
    },
    cpc: {
        type: Number,
        default: 0
    },
    ctr: {
        type: Number,
        default: 0
    },
    costPerLead: {
        type: Number,
        default: 0
    },
    conversionRate: {
        type: Number,
        default: 0
    },
    videoViews: {
        type: Number,
        default: 0
    },
    videoViewsP25: {
        type: Number,
        default: 0
    },
    videoViewsP50: {
        type: Number,
        default: 0
    },
    videoViewsP75: {
        type: Number,
        default: 0
    },
    videoViewsP100: {
        type: Number,
        default: 0
    },
    lastSyncedAt: {
        type: Date,
        default: null
    }
}, { _id: false });

const budgetSchema = new mongoose.Schema({
    budgetType: {
        type: String,
        enum: ['daily', 'lifetime', 'weekly'],
        default: 'daily'
    },
    daily: {
        type: Number,
        default: null
    },
    total: {
        type: Number,
        default: null
    },
    spent: {
        type: Number,
        default: 0
    },
    remaining: {
        type: Number,
        default: null
    },
    currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP'],
        default: 'INR'
    },
    bidStrategy: {
        type: String,
        enum: ['lowest_cost', 'cost_cap', 'bid_cap', 'target_cost'],
        default: 'lowest_cost'
    },
    bidAmount: {
        type: Number,
        default: null
    }
}, { _id: false });

const campaignSchema = new mongoose.Schema({
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
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true,
        index: true
    },
    facebookCampaignId: {
        type: String,
        required: true,
        unique: true
    },
    facebookCampaignUrl: {
        type: String,
        default: null,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Facebook campaign URL must be a valid HTTP/HTTPS URL'
        }
    },
    campaignDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: [
            'active', 
            'paused', 
            'completed', 
            'inactive',
            'draft',
            'scheduled',
            'archived',
            'deleted',
            'error',
            'pending_review',
            'disapproved',
            'limited'
        ],
        default: 'active',
        index: true
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
    // Campaign timing
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
    archivedAt: {
        type: Date,
        default: null
    },
    // Performance metrics
    metrics: {
        type: metricsSchema,
        default: () => ({})
    },
    // Budget information
    budget: {
        type: budgetSchema,
        default: () => ({})
    },
    // Campaign schedule
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    // Delivery settings
    deliveryType: {
        type: String,
        enum: ['standard', 'accelerated'],
        default: 'standard'
    },
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
    // Targeting summary (for quick reference)
    targetingSummary: {
        ageRange: {
            min: Number,
            max: Number
        },
        gender: String,
        locationCount: {
            type: Number,
            default: 0
        },
        interestCount: {
            type: Number,
            default: 0
        }
    },
    // Creative summary
    creativeSummary: {
        totalCreatives: {
            type: Number,
            default: 0
        },
        imageCount: {
            type: Number,
            default: 0
        },
        videoCount: {
            type: Number,
            default: 0
        },
        adType: String
    },
    // Campaign performance tracking
    performanceStatus: {
        type: String,
        enum: ['excellent', 'good', 'average', 'poor', 'needs_attention'],
        default: 'average'
    },
    lastOptimizedAt: {
        type: Date,
        default: null
    },
    // Attribution and tracking
    attribution: {
        type: String,
        enum: ['1_day_view', '7_day_view', '1_day_click', '7_day_click', '28_day_click'],
        default: '7_day_click'
    },
    utmParameters: {
        source: String,
        medium: String,
        campaign: String,
        term: String,
        content: String
    },
    // Tags and categorization
    tags: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        enum: [
            'awareness',
            'acquisition',
            'retention',
            'conversion',
            'engagement',
            'brand',
            'product',
            'seasonal',
            'promotional',
            'test'
        ],
        default: 'awareness'
    },
    // Notes and comments
    notes: {
        type: String,
        maxlength: 2000,
        default: null
    },
    adminNotes: {
        type: String,
        maxlength: 1000,
        default: null
    },
    superAdminNotes: {
        type: String,
        maxlength: 1000,
        default: null
    },
    // External integrations
    integrations: {
        googleAnalytics: {
            trackingId: String,
            enabled: {
                type: Boolean,
                default: false
            }
        },
        facebookPixel: {
            pixelId: String,
            enabled: {
                type: Boolean,
                default: false
            }
        },
        customConversions: [{
            name: String,
            eventName: String,
            value: Number
        }]
    },
    // Approval workflow
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'needs_revision'],
        default: 'approved'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    approvedAt: {
        type: Date,
        default: null
    },
    // Auto-optimization settings
    autoOptimization: {
        enabled: {
            type: Boolean,
            default: false
        },
        rules: [{
            condition: String,
            action: String,
            threshold: Number
        }]
    },
    // Reporting schedule
    reportingSchedule: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'never'],
            default: 'weekly'
        },
        recipients: [String],
        lastReportSentAt: Date
    },
    // Campaign health indicators
    healthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
    },
    alerts: [{
        type: {
            type: String,
            enum: ['budget_exhausted', 'low_performance', 'high_cpm', 'low_reach', 'delivery_issue']
        },
        message: String,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical']
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        resolved: {
            type: Boolean,
            default: false
        }
    }],
    // Versioning and history
    version: {
        type: Number,
        default: 1
    },
    parentCampaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    }
}, { 
    timestamps: true,
    collection: 'campaigns'
});

// Indexes for better query performance
campaignSchema.index({ adminId: 1, status: 1 });
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ facebookCampaignId: 1 });
campaignSchema.index({ originalRequestId: 1 });
campaignSchema.index({ createdBy: 1, createdAt: -1 });
campaignSchema.index({ workflowId: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ objective: 1, platform: 1 });
campaignSchema.index({ performanceStatus: 1 });
campaignSchema.index({ isDeleted: 1, status: 1 });

// Virtual for campaign duration
campaignSchema.virtual('duration').get(function() {
    if (this.startDate && this.endDate) {
        return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
    }
    return null;
});

// Virtual for days remaining
campaignSchema.virtual('daysRemaining').get(function() {
    if (this.endDate) {
        const now = new Date();
        const remaining = Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
        return remaining > 0 ? remaining : 0;
    }
    return null;
});

// Virtual for budget utilization percentage
campaignSchema.virtual('budgetUtilization').get(function() {
    if (this.budget && this.budget.total && this.budget.spent) {
        return (this.budget.spent / this.budget.total) * 100;
    }
    return 0;
});

// Virtual for average daily spend
campaignSchema.virtual('averageDailySpend').get(function() {
    if (this.metrics && this.metrics.spend && this.startDate) {
        const daysSinceStart = Math.ceil((new Date() - this.startDate) / (1000 * 60 * 60 * 24));
        return daysSinceStart > 0 ? this.metrics.spend / daysSinceStart : 0;
    }
    return 0;
});

// Pre-save middleware to calculate budget remaining
campaignSchema.pre('save', function(next) {
    if (this.budget && this.budget.total && this.budget.spent !== undefined) {
        this.budget.remaining = this.budget.total - this.budget.spent;
    }
    next();
});

// Static method to get active campaigns
campaignSchema.statics.getActiveCampaigns = function(adminId = null) {
    const query = { 
        status: 'active',
        isDeleted: false,
        $or: [
            { endDate: { $exists: false } },
            { endDate: { $gt: new Date() } }
        ]
    };
    
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name')
        .populate('createdBy', 'first_name last_name')
        .populate('workflowId', 'name')
        .sort({ createdAt: -1 });
};

// Static method to get campaigns by performance
campaignSchema.statics.getCampaignsByPerformance = function(performanceStatus, adminId = null) {
    const query = { 
        performanceStatus,
        status: 'active',
        isDeleted: false
    };
    
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name')
        .sort({ 'metrics.lastSyncedAt': -1 });
};

// Static method to get campaigns needing attention
campaignSchema.statics.getCampaignsNeedingAttention = function(adminId = null) {
    const query = {
        status: 'active',
        isDeleted: false,
        $or: [
            { performanceStatus: 'poor' },
            { performanceStatus: 'needs_attention' },
            { 'alerts.resolved': false },
            { 'budget.remaining': { $lt: 100 } }, // Less than 100 currency units remaining
            { healthScore: { $lt: 30 } }
        ]
    };
    
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name')
        .sort({ healthScore: 1, 'metrics.lastSyncedAt': -1 });
};

// Method to update campaign metrics
campaignSchema.methods.updateMetrics = function(newMetrics) {
    if (!this.metrics) this.metrics = {};
    
    Object.assign(this.metrics, newMetrics);
    this.metrics.lastSyncedAt = new Date();
    
    // Calculate derived metrics
    if (this.metrics.impressions && this.metrics.clicks) {
        this.metrics.ctr = (this.metrics.clicks / this.metrics.impressions) * 100;
    }
    
    if (this.metrics.spend && this.metrics.impressions) {
        this.metrics.cpm = (this.metrics.spend / this.metrics.impressions) * 1000;
    }
    
    if (this.metrics.spend && this.metrics.clicks) {
        this.metrics.cpc = this.metrics.spend / this.metrics.clicks;
    }
    
    if (this.metrics.leads && this.metrics.spend) {
        this.metrics.costPerLead = this.metrics.spend / this.metrics.leads;
    }
    
    if (this.metrics.conversions && this.metrics.clicks) {
        this.metrics.conversionRate = (this.metrics.conversions / this.metrics.clicks) * 100;
    }
    
    // Update budget spent
    if (this.budget && newMetrics.spend !== undefined) {
        this.budget.spent = newMetrics.spend;
        this.budget.remaining = this.budget.total - this.budget.spent;
    }
    
    // Update performance status based on metrics
    this.updatePerformanceStatus();
    
    return this.save();
};

// Method to update performance status
campaignSchema.methods.updatePerformanceStatus = function() {
    if (!this.metrics) return;
    
    let score = 50; // Base score
    
    // CTR scoring
    if (this.metrics.ctr >= 2) score += 20;
    else if (this.metrics.ctr >= 1) score += 10;
    else if (this.metrics.ctr < 0.5) score -= 20;
    
    // CPC scoring (lower is better)
    if (this.metrics.cpc <= 5) score += 15;
    else if (this.metrics.cpc <= 10) score += 5;
    else if (this.metrics.cpc > 20) score -= 15;
    
    // Conversion rate scoring
    if (this.metrics.conversionRate >= 5) score += 15;
    else if (this.metrics.conversionRate >= 2) score += 5;
    else if (this.metrics.conversionRate < 1) score -= 10;
    
    // Budget utilization scoring
    const budgetUtil = this.budgetUtilization;
    if (budgetUtil > 90) score -= 10; // Over budget
    else if (budgetUtil < 10) score -= 5; // Under-delivering
    
    this.healthScore = Math.max(0, Math.min(100, score));
    
    // Set performance status based on health score
    if (this.healthScore >= 80) this.performanceStatus = 'excellent';
    else if (this.healthScore >= 60) this.performanceStatus = 'good';
    else if (this.healthScore >= 40) this.performanceStatus = 'average';
    else if (this.healthScore >= 20) this.performanceStatus = 'poor';
    else this.performanceStatus = 'needs_attention';
};

// Method to add alert
campaignSchema.methods.addAlert = function(alertType, message, severity = 'medium') {
    if (!this.alerts) this.alerts = [];
    
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert => 
        alert.type === alertType && !alert.resolved
    );
    
    if (!existingAlert) {
        this.alerts.push({
            type: alertType,
            message,
            severity,
            createdAt: new Date(),
            resolved: false
        });
        
        return this.save();
    }
    
    return Promise.resolve(this);
};

// Method to resolve alerts
campaignSchema.methods.resolveAlerts = function(alertTypes = []) {
    if (!this.alerts) return Promise.resolve(this);
    
    this.alerts.forEach(alert => {
        if (alertTypes.length === 0 || alertTypes.includes(alert.type)) {
            alert.resolved = true;
        }
    });
    
    return this.save();
};

const Campaign = mongoose.model('Campaigns', campaignSchema);
module.exports = { Campaign };