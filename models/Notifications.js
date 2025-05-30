// models/Notifications.js - Updated Notification model with comprehensive enum values

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Notification content
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    
    // Notification type
    type: {
        type: String,
        required: true,
        enum: [
            // System notifications
            'system_alert',
            'system_maintenance',
            'system_update',
            'system_error',
            'configuration_warning',
            'service_status',
            
            // User notifications
            'user_registered',
            'user_updated',
            'user_deleted',
            'user_verification_completed',
            'user_kyc_completed',
            'user_session_completed',
            'user_login',
            'user_logout',
            
            // Admin notifications
            'admin_created',
            'admin_updated',
            'admin_deleted',
            'admin_login',
            'admin_logout',
            'admin_action_required',
            'admin_approval_pending',
            'admin_report_ready',
            
            // Agent notifications
            'agent_created',
            'agent_updated',
            'agent_deleted',
            'agent_assigned',
            'agent_unassigned',
            
            // Workflow notifications
            'workflow_created',
            'workflow_updated',
            'workflow_deleted',
            'workflow_activated',
            'workflow_deactivated',
            'kyc_workflow_created',
            'workflow_execution_failed',
            'workflow_completed',
            'configuration_warning',      // Used for SurePass config warnings
            
            // Campaign notifications
            'campaign_request',
            'campaign_created',
            'campaign_updated',
            'campaign_deleted',
            'campaign_started',
            'campaign_completed',
            'campaign_paused',
            'campaign_resumed',
            'campaign_published',
            'campaign_approved',
            'campaign_rejected',
            'campaign_milestone_reached',
            
            // Product notifications
            'product_request',
            'product_created',
            'product_updated',
            'product_deleted',
            'product_approved',
            'product_rejected',
            'product_published',
            'product_approval',
            'product_rejection',
            
            // Call notifications
            'call_initiated',
            'call_completed',
            'call_failed',
            'call_missed',
            'call_recording_ready',
            'call_callback_required',
            'call_follow_up_due',
            'call_transferred',
            'dtmf_received',
            'call_limit_reached',
            'call_cost_alert',
            
            // Message notifications
            'message_sent',
            'message_failed',
            'message_delivered',
            'bulk_message_sent',
            'bulk_message_completed',
            'message_received',
            
            // Verification notifications
            'verification_successful',
            'verification_failed',
            'verification_pending',
            'verification_retried',
            'kyc_verification_completed',
            'kyc_verification_failed',
            
            // Analytics notifications
            'report_ready',
            'report_generated',
            'analytics_milestone',
            'usage_threshold_reached',
            'analytics_summary',
            
            // Security notifications
            'login_failed_multiple',
            'account_locked',
            'account_unlocked',
            'suspicious_activity',
            'password_changed',
            'password_reset',
            'two_factor_enabled',
            'two_factor_disabled',
            'security_alert',
            
            // Integration notifications
            'api_limit_reached',
            'api_key_generated',
            'api_key_revoked',
            'webhook_failed',
            'webhook_configured',
            'service_integration_failed',
            'surepass_quota_warning',
            'exotel_balance_low',
            'integration_error',
            
            // File notifications
            'file_uploaded',
            'file_download_ready',
            'file_processing_complete',
            'file_error',
            
            // Generic notifications
            'info',
            'success',
            'warning',
            'error',
            'reminder',
            'update',
            'alert'
        ],
        index: true
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent', 'critical'],
        default: 'medium',
        index: true
    },
    
    // Notification status
    status: {
        type: String,
        enum: ['unread', 'read', 'archived', 'dismissed', 'expired'],
        default: 'unread',
        index: true
    },
    
    // Recipient information - Updated to support new roles
    forSuperAdmin: {
        type: Boolean,
        default: false,
        index: true
    },
    
    forAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        index: true
    },
    
    forAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        index: true
    },
    
    forUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    
    // Global notification (for all users of specific roles)
    isGlobal: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // Role-based notification
    forRoles: [{
        type: String,
        enum: ['super_admin', 'admin', 'agent', 'moderator', 'support', 'viewer', 'user']
    }],
    
    // Read tracking
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        userType: {
            type: String,
            enum: ['SuperAdmin', 'Admin', 'Agent', 'User'],
            required: true
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Related entity
    relatedTo: {
        model: {
            type: String,
            enum: [
                'Users', 
                'Admins', 
                'SuperAdmins',
                'Agents',
                'Workflows', 
                'Sessions', 
                'Messages', 
                'Campaigns',
                'CampaignRequests',
                'Products',
                'ProductRequests',
                'ProductCatalogs',
                'Verifications',
                'Calls',
                'Recordings',
                'PhoneNumbers',
                'Reports',
                'Analytics',
                'FileUploads',
                'Integrations',
                'System',
                'Workflow'
            ]
        },
        id: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    
    // Call-specific metadata
    callMetadata: {
        callSid: String,
        fromNumber: String,
        toNumber: String,
        duration: String,
        status: String,
        recordingAvailable: Boolean,
        callCost: Number,
        followUpRequired: Boolean
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Action information
    actionUrl: {
        type: String,
        maxlength: 500
    },
    
    actionLabel: {
        type: String,
        maxlength: 50
    },
    
    actionRequired: {
        type: Boolean,
        default: false
    },
    
    // Scheduling
    scheduledFor: {
        type: Date,
        index: true
    },
    
    isScheduled: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // Expiration
    expiresAt: {
        type: Date,
        index: true
    },
    
    // Delivery information
    deliveredAt: {
        type: Date
    },
    
    readAt: {
        type: Date
    },
    
    dismissedAt: {
        type: Date
    },
    
    // Source information
    source: {
        type: String,
        enum: [
            'system',
            'workflow',
            'campaign', 
            'api',
            'webhook',
            'manual',
            'scheduler',
            'exotel',
            'surepass',
            'whatsapp',
            'facebook',
            'instagram',
            'email',
            'sms',
            'notification_service'
        ],
        default: 'system'
    },
    
    // Categorization
    category: {
        type: String,
        enum: [
            'system',
            'user_activity',
            'admin_activity',
            'workflow',
            'communication',
            'verification',
            'campaign',
            'product',
            'security',
            'analytics',
            'integration',
            'file_management',
            'authentication',
            'other'
        ],
        default: 'other',
        index: true
    },
    
    // Tags for filtering
    tags: [{
        type: String,
        trim: true
    }],
    
    // Notification channel preferences
    channels: {
        inApp: {
            type: Boolean,
            default: true
        },
        email: {
            type: Boolean,
            default: false
        },
        sms: {
            type: Boolean,
            default: false
        },
        push: {
            type: Boolean,
            default: false
        },
        webhook: {
            type: Boolean,
            default: false
        },
        whatsapp: {
            type: Boolean,
            default: false
        }
    },
    
    // Delivery status for different channels
    deliveryStatus: {
        inApp: {
            status: {
                type: String,
                enum: ['pending', 'delivered', 'failed', 'skipped'],
                default: 'pending'
            },
            deliveredAt: Date,
            error: String
        },
        email: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped'],
                default: 'pending'
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String
        },
        sms: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
                default: 'pending'
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String
        },
        push: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
                default: 'pending'
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String
        },
        webhook: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
                default: 'pending'
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String
        }
    },
    
    // Retry information
    retryCount: {
        type: Number,
        default: 0
    },
    
    maxRetries: {
        type: Number,
        default: 3
    },
    
    nextRetryAt: {
        type: Date
    },
    
    // Grouping (for batch notifications)
    groupId: {
        type: String,
        index: true
    },
    
    batchId: {
        type: String,
        index: true
    },
    
    // Template information
    templateId: {
        type: String
    },
    
    templateVariables: {
        type: mongoose.Schema.Types.Mixed
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
    collection: 'notifications'
});

// Indexes for better query performance
notificationSchema.index({ forAdmin: 1, status: 1, createdAt: -1 });
notificationSchema.index({ forAgent: 1, status: 1, createdAt: -1 });
notificationSchema.index({ forUser: 1, status: 1, createdAt: -1 });
notificationSchema.index({ forSuperAdmin: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, status: 1 });
notificationSchema.index({ isGlobal: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isScheduled: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ 'callMetadata.callSid': 1 });
notificationSchema.index({ category: 1, type: 1 });

// Virtual for recipient display
notificationSchema.virtual('recipientDisplay').get(function() {
    if (this.isGlobal) return 'All Users';
    if (this.forSuperAdmin) return 'Super Admin';
    if (this.forAdmin) return 'Admin';
    if (this.forAgent) return 'Agent';
    if (this.forUser) return 'User';
    if (this.forRoles && this.forRoles.length > 0) return this.forRoles.join(', ');
    return 'Unknown';
});

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diffMs = now - this.createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
    try {
        const notification = new this(notificationData);
        await notification.save();
        
        // You can add real-time notification logic here
        // e.g., emit socket event, send email, etc.
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(notificationIds, recipientId, recipientType = 'Admin') {
    try {
        const result = await this.updateMany(
            { 
                _id: { $in: notificationIds }, 
                $or: [
                    { forAdmin: recipientId },
                    { forAgent: recipientId },
                    { forUser: recipientId },
                    { forSuperAdmin: true },
                    { isGlobal: true }
                ]
            },
            { 
                status: 'read',
                readAt: new Date(),
                $addToSet: {
                    readBy: {
                        userId: recipientId,
                        userType: recipientType,
                        readAt: new Date()
                    }
                }
            }
        );
        
        return result;
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        throw error;
    }
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(recipientId, recipientType = 'admin') {
    try {
        const query = {
            status: 'unread',
            isDeleted: false
        };
        
        // Build recipient query based on type
        const recipientQuery = { $or: [] };
        
        if (recipientType === 'superadmin') {
            recipientQuery.$or.push({ forSuperAdmin: true });
        } else if (recipientType === 'admin') {
            recipientQuery.$or.push(
                { forAdmin: recipientId },
                { isGlobal: true, forRoles: 'admin' }
            );
        } else if (recipientType === 'agent') {
            recipientQuery.$or.push(
                { forAgent: recipientId },
                { isGlobal: true, forRoles: 'agent' }
            );
        } else if (recipientType === 'user') {
            recipientQuery.$or.push(
                { forUser: recipientId },
                { isGlobal: true, forRoles: 'user' }
            );
        }
        
        // Add recipient query to main query
        query.$and = [recipientQuery];
        
        // Check for expiration
        const now = new Date();
        query.$or = [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: now } }
        ];
        
        const count = await this.countDocuments(query);
        return count;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};

// Middleware to handle expiration
notificationSchema.pre('find', function() {
    const now = new Date();
    this.where({
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: now } }
        ]
    });
});

const Notification = mongoose.model('Notifications', notificationSchema);

module.exports = { Notification };