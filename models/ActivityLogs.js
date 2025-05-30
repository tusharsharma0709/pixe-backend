// models/ActivityLogs.js - Updated ActivityLog model with comprehensive enum values

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
        enum: ['Admins', 'SuperAdmins', 'Agents', 'Users', 'System'],
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
            // Authentication actions
            'login', 
            'logout', 
            'register', 
            'password_change', 
            'password_reset',
            'two_factor_enabled',
            'two_factor_disabled',
            'login_failed',
            'account_locked',
            'password_reset_requested',

            // User management actions
            'user_created',
            'user_updated', 
            'user_deleted',
            'user_login',
            'user_logout',
            'user_password_changed',
            'user_profile_updated',
            'user_activated',
            'user_deactivated',
            
            // Admin management actions
            'admin_created',
            'admin_updated',
            'admin_deleted',
            'admin_login',
            'admin_logout',
            'admin_role_changed',
            'admin_activated',
            'admin_deactivated',
            
            // SuperAdmin management actions
            'superadmin_created',
            'superadmin_updated',
            'superadmin_deleted',
            'superadmin_login',
            'superadmin_logout',
            
            // Agent management actions
            'agent_created',
            'agent_updated',
            'agent_deleted',
            'agent_login',
            'agent_logout',
            'agent_assigned',
            'agent_unassigned',
            
            // Workflow actions
            'workflow_created',
            'workflow_updated',
            'workflow_deleted',
            'workflow_activated',
            'workflow_deactivated',
            'workflow_executed',
            'workflow_failed',
            'kyc_workflow_created',      // Used in controller for KYC workflows
            'workflow_tested',           // Used in controller test functionality
            'workflow_previewed',        // Used in controller preview functionality
            'workflow_cloned',           // Used in controller clone functionality
            'workflow_template_created',
            
            // Session actions
            'session_started',
            'session_completed',
            'session_abandoned',
            'session_resumed',
            'session_paused',
            
            // Verification actions
            'verification_initiated',
            'verification_completed',
            'verification_failed',
            'verification_retried',
            'kyc_verification_completed',
            
            // Call management actions
            'call_initiated',
            'call_completed',
            'call_failed',
            'call_hung_up',
            'call_missed',
            'call_recording_accessed',
            'call_notes_updated',
            'call_transferred',
            'call_hold',
            'call_resumed',
            'dtmf_sent',
            'dtmf_received',
            
            // Campaign actions
            'campaign_requested',
            'campaign_created',
            'campaign_updated',
            'campaign_deleted',
            'campaign_started',
            'campaign_paused',
            'campaign_resumed',
            'campaign_completed',
            'campaign_published',
            'campaign_approved',
            'campaign_rejected',
            'campaign_reviewed',
            
            // Product actions
            'product_created',
            'product_updated',
            'product_deleted',
            'product_approved',
            'product_rejected',
            'product_published',
            'product_reviewed',
            'product_catalog_created',
            'product_catalog_updated',
            'product_catalog_deleted',
            
            // Message actions
            'message_sent',
            'message_received',
            'message_failed',
            'message_delivered',
            'bulk_message_sent',
            
            // Notification actions
            'notification_sent',
            'notification_read',
            'notification_dismissed',
            'notification_created',
            
            // Analytics actions
            'report_generated',
            'report_downloaded',
            'report_viewed',
            'analytics_viewed',
            'dashboard_accessed',
            
            // System actions
            'system_backup',
            'system_restore',
            'system_maintenance',
            'configuration_updated',
            'integration_configured',
            'settings_updated',
            
            // API actions
            'api_key_generated',
            'api_key_revoked',
            'api_request_made',
            'webhook_configured',
            'webhook_triggered',
            
            // Security actions
            'suspicious_activity',
            'security_alert',
            'permissions_changed',
            'role_assigned',
            'role_removed',
            
            // Data actions
            'data_exported',
            'data_imported',
            'data_deleted',
            'data_backed_up',
            'bulk_operation_performed',
            
            // File actions
            'file_uploaded',
            'file_downloaded',
            'file_deleted',
            'file_shared',
            
            // Generic actions
            'created',
            'updated',
            'deleted',
            'viewed',
            'accessed',
            'archived',
            'restored'
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
            'SuperAdmin',
            'Agent',
            'Workflow',
            'Session',
            'Message',
            'Campaign',
            'CampaignRequest',
            'Product',
            'ProductRequest',
            'ProductCatalog',
            'Verification',
            'Call',
            'Recording',
            'PhoneNumber',
            'Notification',
            'ActivityLog',
            'Report',
            'Analytics',
            'ApiKey',
            'Configuration',
            'FileUpload',
            'Integration',
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
    
    // Additional details
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Changed fields (for update operations)
    changedFields: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Call-specific metadata
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
    
    // SuperAdmin context
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        index: true
    },
    
    // Agent context
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        index: true
    },
    
    // User context (if applicable)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    
    // Network and device information
    ip: {
        type: String
    },
    
    userAgent: {
        type: String
    },
    
    deviceInfo: {
        type: mongoose.Schema.Types.Mixed
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
        enum: ['success', 'failure', 'pending', 'warning', 'error'],
        default: 'success',
        index: true
    },
    
    category: {
        type: String,
        enum: [
            'authentication',
            'user_management', 
            'admin_management',
            'workflow_management',
            'communication',
            'verification',
            'campaign_management',
            'product_management',
            'system_administration',
            'data_management',
            'security',
            'api_usage',
            'analytics',
            'configuration',
            'file_management',
            'notification',
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
activityLogSchema.index({ superAdminId: 1, createdAt: -1 });
activityLogSchema.index({ agentId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, priority: 1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ 'callMetadata.callSid': 1 });

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
            .populate('superAdminId', 'first_name last_name')
            .populate('agentId', 'first_name last_name')
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