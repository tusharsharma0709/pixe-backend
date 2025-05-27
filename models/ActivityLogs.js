// models/ActivityLogs.js - Updated ActivityLog model with call-related actions

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    // Actor information (who performed the action)
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    
    actorModel: {
        type: String,
        required: true,
        enum: ['Admins', 'Users', 'System'],
        index: true
    },
    
    actorName: {
        type: String,
        required: true
    },
    
    // Action performed
    action: {
        type: String,
        required: true,
        enum: [
            // Authentication
            'login', 
            'logout', 
            'register', 
            'password_change', 
            'password_reset',

            // User management actions
            'user_created',
            'user_updated', 
            'user_deleted',
            'user_login',
            'user_logout',
            'user_password_changed',
            'user_profile_updated',
            
            // Admin management actions
            'admin_created',
            'admin_updated',
            'admin_deleted',
            'admin_login',
            'admin_logout',
            'admin_role_changed',
            
            // Workflow actions
            'workflow_created',
            'workflow_updated',
            'workflow_deleted',
            'workflow_activated',
            'workflow_deactivated',
            'kyc_workflow_created',
            
            // Session actions
            'session_started',
            'session_completed',
            'session_abandoned',
            'session_resumed',
            
            // Verification actions
            'verification_initiated',
            'verification_completed',
            'verification_failed',
            'kyc_verification_completed',
            
            // Call management actions - NEW
            'call_initiated',
            'call_completed',
            'call_failed',
            'call_hung_up',
            'call_recording_accessed',
            'call_notes_updated',
            'dtmf_sent',
            
            // Campaign actions
            'campaign_created',
            'campaign_updated',
            'campaign_deleted',
            'campaign_started',
            'campaign_paused',
            'campaign_completed',
            
            // Message actions
            'message_sent',
            'message_received',
            'message_failed',
            'bulk_message_sent',
            
            // Analytics actions
            'report_generated',
            'report_downloaded',
            'analytics_viewed',
            
            // System actions
            'system_backup',
            'system_restore',
            'configuration_updated',
            'integration_configured',
            
            // API actions
            'api_key_generated',
            'api_key_revoked',
            'webhook_configured',
            
            // Security actions
            'login_failed',
            'account_locked',
            'password_reset_requested',
            'two_factor_enabled',
            'two_factor_disabled',
            
            // Data actions
            'data_exported',
            'data_imported',
            'data_deleted',
            'bulk_operation_performed',
            
            // Generic actions
            'created',
            'updated',
            'deleted',
            'viewed',
            'accessed'
        ],
        index: true
    },
    
    // Entity affected by the action
    entityType: {
        type: String,
        required: true,
        enum: [
            'User',
            'Admin', 
            'Workflow',
            'Session',
            'Message',
            'Campaign',
            'Verification',
            'Call',        // NEW
            'Recording',   // NEW
            'PhoneNumber', // NEW
            'Notification',
            'ActivityLog',
            'Report',
            'ApiKey',
            'Configuration',
            'System'
        ],
        index: true
    },
    
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    
    entityName: {
        type: String
    },
    
    // Action description
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Call-specific metadata - NEW
    callMetadata: {
        callSid: String,
        fromNumber: String,
        toNumber: String,
        duration: String,
        status: String,
        recordingUrl: String,
        cost: Number
    },
    
    // Admin context
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        index: true
    },
    
    // User context (if applicable)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    
    // IP and device information
    ipAddress: {
        type: String
    },
    
    userAgent: {
        type: String
    },
    
    deviceInfo: {
        type: String
    },
    
    // Location information
    location: {
        country: String,
        state: String,
        city: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    
    // Request information
    requestId: {
        type: String,
        index: true
    },
    
    sessionId: {
        type: String,
        index: true
    },
    
    // Status and categorization
    status: {
        type: String,
        enum: ['success', 'failed', 'pending', 'warning'],
        default: 'success',
        index: true
    },
    
    category: {
        type: String,
        enum: [
            'authentication',
            'user_management', 
            'workflow_management',
            'communication',    // NEW - for call-related activities
            'verification',
            'campaign_management',
            'system_administration',
            'data_management',
            'security',
            'api_usage',
            'analytics',
            'configuration',
            'other'
        ],
        default: 'other',
        index: true
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },
    
    // Tags for filtering
    tags: [{
        type: String,
        trim: true
    }],
    
    // Related activities
    relatedActivities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ActivityLogs'
    }],
    
    // Error information (if action failed)
    errorDetails: {
        code: String,
        message: String,
        stack: String
    },
    
    // Audit trail
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed
    },
    
    // Duration of action (in milliseconds)
    duration: {
        type: Number
    },
    
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    
    deletedAt: {
        type: Date
    }

}, {
    timestamps: true,
    collection: 'activity_logs'
});

// Indexes for better query performance
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });
activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, priority: 1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ 'callMetadata.callSid': 1 }); // NEW - for call lookups

// Virtual for human-readable timestamp
activityLogSchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleString();
});

// Virtual for actor display name
activityLogSchema.virtual('actorDisplayName').get(function() {
    return this.actorName || 'Unknown Actor';
});

// Static method to log activity
activityLogSchema.statics.logActivity = async function(activityData) {
    try {
        const activity = new this(activityData);
        await activity.save();
        return activity;
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error;
    }
};

// Static method to get activities with pagination
activityLogSchema.statics.getActivities = async function(filters = {}, options = {}) {
    const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = options;

    const query = { isDeleted: false, ...filters };
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
        this.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('actorId', 'first_name last_name email')
            .populate('adminId', 'first_name last_name')
            .populate('userId', 'first_name last_name phone_number'),
        this.countDocuments(query)
    ]);

    return {
        activities,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalRecords: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
        }
    };
};

const ActivityLog = mongoose.model('ActivityLogs', activityLogSchema);

module.exports = { ActivityLog };