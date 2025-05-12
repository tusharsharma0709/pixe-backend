// models/Reports.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: [
            'campaign_performance', 
            'agent_performance', 
            'lead_conversion', 
            'workflow_analytics',
            'customer_engagement',
            'admin_performance',
            'sales_report',
            'system_usage',
            'financial_report',
            'custom'
        ],
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    dateRange: {
        start: {
            type: Date,
            required: true
        },
        end: {
            type: Date,
            required: true
        }
    },
    filters: {
        type: Object,
        default: {}
    },
    data: {
        type: Object,
        default: {}
    },
    metrics: [{
        name: String,
        value: mongoose.Schema.Types.Mixed,
        changePercentage: Number,
        changePeriod: String
    }],
    dimensions: [{
        name: String,
        values: [mongoose.Schema.Types.Mixed]
    }],
    visualizations: [{
        type: {
            type: String,
            enum: ['bar', 'line', 'pie', 'table', 'number', 'map', 'heatmap', 'custom'],
            required: true
        },
        title: String,
        data: Object,
        options: Object
    }],
    status: {
        type: String,
        enum: ['scheduled', 'running', 'completed', 'failed', 'archived'],
        default: 'scheduled'
    },
    format: {
        type: String,
        enum: ['json', 'pdf', 'csv', 'xlsx', 'html'],
        default: 'json'
    },
    schedule: {
        frequency: {
            type: String,
            enum: ['one_time', 'daily', 'weekly', 'monthly', 'custom'],
            default: 'one_time'
        },
        nextRun: {
            type: Date,
            default: null
        },
        lastRun: {
            type: Date,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    recipients: [{
        email: String,
        type: {
            type: String,
            enum: ['admin', 'superadmin', 'agent', 'external'],
            default: 'external'
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    }],
    fileUrl: {
        type: String,
        default: null
    },
    error: {
        message: {
            type: String,
            default: null
        },
        details: {
            type: Object,
            default: null
        },
        occurredAt: {
            type: Date,
            default: null
        }
    },
    sharedWith: [{
        type: {
            type: String,
            enum: ['admin', 'superadmin', 'agent'],
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        permissions: {
            type: String,
            enum: ['view', 'edit', 'delete'],
            default: 'view'
        },
        sharedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    publicAccessToken: {
        type: String,
        default: null
    },
    tags: [{
        type: String
    }]
}, {
    timestamps: true
});

// Add indexes for faster queries
reportSchema.index({ adminId: 1, type: 1, createdAt: -1 });
reportSchema.index({ superAdminId: 1, type: 1, createdAt: -1 });
reportSchema.index({ type: 1, 'dateRange.start': 1, 'dateRange.end': 1 });
reportSchema.index({ 'schedule.frequency': 1, 'schedule.nextRun': 1, 'schedule.isActive': 1 });

const Report = mongoose.model('Reports', reportSchema);
module.exports = { Report };