// models/Notifications.js - Updated Notification model with call-related types

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
            'configuration_warning',
            
            // User notifications
            'user_registered',
            'user_verification_completed',
            'user_kyc_completed',
            'user_session_completed',
            
            // Workflow notifications
            'workflow_created',
            'workflow_updated',
            'workflow_deleted',
            'kyc_workflow_created',
            'workflow_execution_failed',
            
            // Campaign notifications
            'campaign_started',
            'campaign_completed',
            'campaign_paused',
            'campaign_milestone_reached',
            
            // Call notifications - NEW
            'call_initiated',
            'call_completed',
            'call_failed',
            'call_missed',
            'call_recording_ready',
            'call_callback_required',
            'call_follow_up_due',
            'dtmf_received',
            'call_limit_reached',
            'call_cost_alert',
            
            // Message notifications
            'message_sent',
            'message_failed',
            'message_delivered',
            'bulk_message_completed',
            
            // Verification notifications
            'verification_successful',
            'verification_failed',
            'verification_pending',
            'kyc_verification_completed',
            
            // Analytics notifications
            'report_ready',
            'analytics_milestone',
            'usage_threshold_reached',
            
            // Security notifications
            'login_failed_multiple',
            'account_locked',
            'suspicious_activity',
            'password_changed',
            
            // Integration notifications
            'api_limit_reached',
            'webhook_failed',
            'service_integration_failed',
            'surepass_quota_warning',
            'exotel_balance_low',  // NEW
            
            // Admin notifications
            'admin_action_required',
            'admin_approval_pending',
            'admin_report_ready',
            
            // Generic notifications
            'info',
            'success',
            'warning',
            'error'
        ],
        index: true
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },
    
    // Notification status
    status: {
        type: String,
        enum: ['unread', 'read', 'archived', 'dismissed'],
        default: 'unread',
        index: true
    },
    
    // Recipient information
    forAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        index: true
    },
    
    forUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    
    // Global notification (for all admins)
    isGlobal: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // Role-based notification
    forRoles: [{
        type: String,
        enum: ['super_admin', 'admin', 'moderator', 'support', 'viewer']
    }],
    
    // Related entity
    relatedTo: {
        model: {
            type: String,
            enum: [
                'Users', 
                'Admins', 
                'Workflows', 
                'Sessions', 
                'Messages', 
                'Campaigns', 
                'Verifications',
                'Calls',        // NEW
                'Recordings',   // NEW
                'PhoneNumbers', // NEW
                'Reports',
                'Analytics',
                'System'
            ]
        },
        id: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    
    // Call-specific metadata - NEW
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
            'exotel',    // NEW
            'surepass',
            'whatsapp'
        ],
        default: 'system'
    },
    
    // Categorization
    category: {
        type: String,
        enum: [
            'system',
            'user_activity',
            'workflow',
            'communication',  // NEW - for call-related notifications
            'verification',
            'campaign',
            'security',
            'analytics',
            'integration',
            'admin',
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
        }
    },
    
    // Delivery status for different channels
    deliveryStatus: {
        inApp: {
            status: {
                type: String,
                enum: ['pending', 'delivered', 'failed'],
                default: 'pending'
            },
            deliveredAt: Date,
            error: String
        },
        email: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed'],
                default: 'pending'
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String
        },
        sms: {
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed'],
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
notificationSchema.index({ forUser: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, status: 1 });
notificationSchema.index({ isGlobal: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isScheduled: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ 'callMetadata.callSid': 1 }); // NEW - for call lookups
notificationSchema.index({ category: 1, type: 1 });

// Virtual for recipient display
notificationSchema.virtual('recipientDisplay').get(function() {
    if (this.isGlobal) return 'All Admins';
    if (this.forAdmin) return 'Admin';
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
notificationSchema.statics.markAsRead = async function(notificationIds, recipientId) {
    try {
        const result = await this.updateMany(
            { 
                _id: { $in: notificationIds }, 
                $or: [
                    { forAdmin: recipientId },
                    { forUser: recipientId },
                    { isGlobal: true }
                ]
            },
            { 
                status: 'read',
                readAt: new Date()
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
            isDeleted: false,
            $or: []
        };
        
        if (recipientType === 'admin') {
            query.$or.push(
                { forAdmin: recipientId },
                { isGlobal: true }
            );
        } else {
            query.$or.push({ forUser: recipientId });
        }
        
        // Check for expiration
        const now = new Date();
        query.$or.push({ expiresAt: { $exists: false } });
        query.$or.push({ expiresAt: { $gt: now } });
        
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