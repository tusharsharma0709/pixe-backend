// models/ActivityLogs.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    actorModel: {
        type: String,
        enum: ['SuperAdmins', 'Admins', 'Agents', 'Users', 'System'],
        required: true
    },
    actorName: {
        type: String,
        default: null
    },
    action: {
        type: String,
        enum: [
            // Authentication
            'login', 'logout', 'register', 'password_change', 'password_reset',
            
            // Admin management
            'admin_created', 'admin_updated', 'admin_approved', 'admin_rejected', 'admin_deleted',
            
            // NEW: Registration flow actions
            'fb_credentials_verified', 'fb_credentials_rejected',
            'facebook_app_created', 'facebook_app_updated',
            'whatsapp_verified', 'whatsapp_rejected',
            'registration_rejected', 'registration_completed',
            
            // Campaign management
            'campaign_requested', 'campaign_reviewed', 'campaign_approved', 'campaign_rejected',
            'campaign_published', 'campaign_updated', 'campaign_deleted', 'campaign_paused',
            
            // Product management
            'product_requested', 'product_reviewed', 'product_approved', 'product_rejected',
            'product_published', 'product_updated', 'product_deleted',
            
            // Workflow management
            'workflow_created', 'workflow_updated', 'workflow_deleted', 'workflow_linked',
            
            // User management
            'user_created', 'user_updated', 'user_deleted', 'user_blocked',
            
            // Agent management
            'agent_created', 'agent_updated', 'agent_deleted', 'agent_blocked',
            
            // Lead management
            'lead_assigned', 'lead_transferred', 'lead_status_changed',
            
            // Order management
            'order_created', 'order_updated', 'order_cancelled', 'order_completed',
            
            // Payment management
            'payment_created', 'payment_updated', 'payment_refunded',
            
            // Verification
            'verification_started', 'verification_completed', 'verification_failed',
            
            // Session management
            'session_started', 'session_completed', 'session_abandoned',
            
            // Message
            'message_sent', 'message_received', 'message_deleted',
            
            // Other
            'report_generated', 'notification_sent', 'settings_updated', 'export_data',
            'import_data', 'system_error', 'custom'
        ],
        required: true
    },
    entityType: {
        type: String,
        enum: [
            'SuperAdmin', 'Admin', 'Agent', 'User', 'Campaign', 'Product', 'Workflow', 
            'CampaignRequest', 'ProductRequest', 'Order', 'Payment', 'Verification',
            'UserSession', 'Message', 'Report', 'Notification', 'Settings', 'LeadAssignment',
            'ProductCatalog', 'System', 'Other'
        ],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    description: {
        type: String,
        required: true
    },
    details: {
        type: Object,
        default: null
    },
    changedFields: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    ip: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    deviceInfo: {
        type: Object,
        default: null
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'warning', 'info'],
        default: 'success'
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    metadata: {
        type: Object,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
activityLogSchema.index({ actorId: 1, actorModel: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLogs', activityLogSchema);
module.exports = { ActivityLog };