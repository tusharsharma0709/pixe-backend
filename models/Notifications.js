// models/Notifications.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'admin_registration',       // New admin registered
            'admin_approval',          // Admin was approved
            'admin_rejection',         // Admin was rejected
            
            // Registration flow types
            'registration_update',     // Registration status update
            'fb_credentials_verified', // Facebook credentials verified
            'fb_credentials_failed',   // Facebook credentials failed
            'facebook_app_created',    // Facebook app created
            'whatsapp_verified',       // WhatsApp number verified
            'whatsapp_failed',         // WhatsApp verification failed
            
            'campaign_request',        // New campaign request
            'campaign_approval',       // Campaign approved
            'campaign_rejection',      // Campaign rejected
            'campaign_published',      // Campaign published
            
            // UPDATED: Product and Catalog notifications
            'product_request',         // New product request
            'product_approval',        // Product approved
            'product_rejection',       // Product rejected
            'product_published',       // Product published to catalog
            'catalog_request',         // New catalog request (pending review)
            'catalog_approval',        // Product catalog approved
            'catalog_rejection',       // Product catalog rejected
            'catalog_published',       // Product catalog published
            
            'lead_assigned',           // Lead assigned to agent
            'lead_update',             // Lead status updated
            'workflow_created',        // New workflow created
            'system',                  // System notification
            'message',                 // New message received
            'agent_performance',       // Agent performance update
            'payment',                 // Payment notification
            'verification',            // Verification completed
            'session_started'          // New session started
        ],
        required: true
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'archived'],
        default: 'unread'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    forSuperAdmin: {
        type: Boolean,
        default: false
    },
    // UPDATED: Use adminId instead of separate field names for consistency
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
    relatedTo: {
        model: {
            type: String,
            enum: [
                'Admin', 
                'Campaign', 
                'CampaignRequest', 
                'Product', 
                'ProductRequest', 
                'ProductCatalog',    // ADDED: ProductCatalog
                'User', 
                'Workflow', 
                'Agent', 
                'UserSession'
            ],
            default: null
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    },
    actionUrl: {
        type: String,
        default: null
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId
        },
        userType: {
            type: String,
            enum: ['SuperAdmin', 'Admin', 'Agent']
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    expireAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
    },
    metadata: {
        type: Object,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
notificationSchema.index({ forSuperAdmin: 1, status: 1, createdAt: -1 });
notificationSchema.index({ adminId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ agentId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const Notification = mongoose.model('Notifications', notificationSchema);
module.exports = { Notification };