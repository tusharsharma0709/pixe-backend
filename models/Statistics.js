// models/Statistics.js
const mongoose = require('mongoose');

const statisticSchema = new mongoose.Schema({
    entityType: {
        type: String,
        enum: [
            'admin', 'agent', 'campaign', 'product', 'workflow', 
            'user', 'order', 'payment', 'verification', 'system'
        ],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
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
    metricType: {
        type: String,
        enum: [
            // User metrics
            'user_registrations', 'user_conversions', 'user_retention',
            
            // Campaign metrics
            'campaign_impressions', 'campaign_clicks', 'campaign_leads', 'campaign_conversions', 'campaign_cost',
            
            // Workflow metrics
            'workflow_completions', 'workflow_abandonment', 'workflow_time', 'workflow_steps', 
            
            // Agent metrics
            'agent_response_time', 'agent_messages', 'agent_active_time', 'agent_leads', 'agent_conversions',
            
            // Order metrics
            'order_count', 'order_value', 'order_items', 'order_cancellations',
            
            // Payment metrics
            'payment_volume', 'payment_success_rate', 'payment_failure_rate', 'payment_refund_rate',
            
            // System metrics
            'system_response_time', 'system_error_rate', 'system_uptime',
            
            // Verification metrics
            'verification_success_rate', 'verification_failure_rate', 'verification_time',
            
            // Custom
            'custom'
        ],
        required: true
    },
    dimension: {
        type: String,
        enum: [
            'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 
            'campaign', 'product', 'workflow', 'agent', 'admin',
            'payment_method', 'geography', 'device', 'platform', 'status', 'custom'
        ],
        default: 'daily'
    },
    dimensionValue: {
        type: String,
        default: null
    },
    date: {
        type: Date,
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    previousValue: {
        type: Number,
        default: null
    },
    changePercentage: {
        type: Number,
        default: null
    },
    metadata: {
        type: Object,
        default: null
    },
    source: {
        type: String,
        enum: ['calculated', 'facebook', 'whatsapp', 'manual', 'system', 'other'],
        default: 'calculated'
    },
    sourceDetails: {
        type: Object,
        default: null
    },
    unit: {
        type: String,
        default: null
    },
    tags: [{
        type: String
    }]
}, {
    timestamps: true
});

// Create composite index for unique metrics
statisticSchema.index({ 
    entityType: 1, 
    entityId: 1, 
    metricType: 1, 
    dimension: 1, 
    dimensionValue: 1, 
    date: 1 
}, { 
    unique: true 
});

// Create indexes for faster queries
statisticSchema.index({ adminId: 1, entityType: 1, metricType: 1, date: -1 });
statisticSchema.index({ agentId: 1, metricType: 1, date: -1 });
statisticSchema.index({ metricType: 1, dimension: 1, date: -1 });
statisticSchema.index({ entityType: 1, entityId: 1, metricType: 1, date: -1 });
statisticSchema.index({ date: -1 });

// Helper method to calculate percentage change
statisticSchema.methods.calculateChange = function(previousValue) {
    if (previousValue === null || previousValue === undefined || previousValue === 0) {
        return null;
    }
    
    const change = ((this.value - previousValue) / Math.abs(previousValue)) * 100;
    return parseFloat(change.toFixed(2));
};

// Static method to upsert statistics
statisticSchema.statics.upsertMetric = async function(metricData) {
    const { 
        entityType, 
        entityId, 
        metricType, 
        dimension, 
        dimensionValue, 
        date, 
        value,
        adminId,
        agentId 
    } = metricData;
    
    const query = { 
        entityType, 
        metricType,
        dimension
    };
    
    if (entityId) query.entityId = entityId;
    if (dimensionValue) query.dimensionValue = dimensionValue;
    if (adminId) query.adminId = adminId;
    if (agentId) query.agentId = agentId;
    
    // Handle date based on dimension
    const metricDate = new Date(date);
    
    if (dimension === 'daily') {
        // Set time to 00:00:00 for daily metrics
        metricDate.setHours(0, 0, 0, 0);
    } else if (dimension === 'weekly') {
        // Set to start of week (Sunday)
        const day = metricDate.getDay();
        metricDate.setDate(metricDate.getDate() - day);
        metricDate.setHours(0, 0, 0, 0);
    } else if (dimension === 'monthly') {
        // Set to start of month
        metricDate.setDate(1);
        metricDate.setHours(0, 0, 0, 0);
    } else if (dimension === 'quarterly') {
        // Set to start of quarter
        const quarter = Math.floor(metricDate.getMonth() / 3);
        metricDate.setMonth(quarter * 3, 1);
        metricDate.setHours(0, 0, 0, 0);
    } else if (dimension === 'yearly') {
        // Set to start of year
        metricDate.setMonth(0, 1);
        metricDate.setHours(0, 0, 0, 0);
    }
    
    query.date = metricDate;
    
    try {
        // Check if a previous value exists for change calculation
        let previousValue = null;
        
        // Get a reference date based on the dimension
        const previousDate = new Date(metricDate);
        
        if (dimension === 'daily') {
            previousDate.setDate(previousDate.getDate() - 1);
        } else if (dimension === 'weekly') {
            previousDate.setDate(previousDate.getDate() - 7);
        } else if (dimension === 'monthly') {
            previousDate.setMonth(previousDate.getMonth() - 1);
        } else if (dimension === 'quarterly') {
            previousDate.setMonth(previousDate.getMonth() - 3);
        } else if (dimension === 'yearly') {
            previousDate.setFullYear(previousDate.getFullYear() - 1);
        }
        
        const previousQuery = { ...query, date: previousDate };
        delete previousQuery.date;
        previousQuery.date = previousDate;
        
        const previousMetric = await this.findOne(previousQuery);
        
        if (previousMetric) {
            previousValue = previousMetric.value;
        }
        
        // Calculate change percentage
        let changePercentage = null;
        if (previousValue !== null && previousValue !== 0) {
            changePercentage = ((value - previousValue) / Math.abs(previousValue)) * 100;
            changePercentage = parseFloat(changePercentage.toFixed(2));
        }
        
        // Prepare the update data
        const updateData = {
            ...metricData,
            date: metricDate,
            previousValue,
            changePercentage
        };
        
        // Upsert the metric
        return await this.findOneAndUpdate(
            query,
            updateData,
            { 
                upsert: true, 
                new: true, 
                setDefaultsOnInsert: true 
            }
        );
    } catch (error) {
        console.error('Error upserting statistic:', error);
        throw error;
    }
};

const Statistic = mongoose.model('Statistics', statisticSchema);
module.exports = { Statistic };