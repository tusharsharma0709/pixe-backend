// models/Webhooks.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookEventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        required: true
    },
    payload: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'retrying'],
        default: 'pending'
    },
    attempts: {
        type: Number,
        default: 0
    },
    lastAttemptAt: {
        type: Date,
        default: null
    },
    nextAttemptAt: {
        type: Date,
        default: null
    },
    response: {
        statusCode: Number,
        body: Object,
        headers: Object
    },
    error: {
        message: String,
        stack: String,
        code: String
    },
    processingTime: {
        type: Number,
        default: null // in milliseconds
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const webhookSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    url: {
        type: String,
        required: true
    },
    secret: {
        type: String,
        default: function() {
            return crypto.randomBytes(32).toString('hex');
        }
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
    events: [{
        type: String,
        enum: [
            // User events
            'user.created', 'user.updated', 'user.verified', 'user.deleted',
            
            // Admin events
            'admin.created', 'admin.updated', 'admin.approved', 'admin.rejected',
            
            // Campaign events
            'campaign.created', 'campaign.approved', 'campaign.published', 'campaign.paused',
            
            // Product events
            'product.created', 'product.approved', 'product.published',
            
            // Order events
            'order.created', 'order.paid', 'order.fulfilled', 'order.cancelled', 'order.refunded',
            
            // Payment events
            'payment.created', 'payment.succeeded', 'payment.failed', 'payment.refunded',
            
            // Verification events
            'verification.started', 'verification.succeeded', 'verification.failed',
            
            // Message events
            'message.sent', 'message.delivered', 'message.read', 'message.received',
            
            // Session events
            'session.started', 'session.updated', 'session.completed', 'session.abandoned',
            
            // Lead events
            'lead.created', 'lead.assigned', 'lead.converted', 'lead.lost',
            
            // Workflow events
            'workflow.started', 'workflow.step_completed', 'workflow.completed',
            
            // System events
            'system.*'
        ],
        required: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        id: {
            type: mongoose.Schema.Types.ObjectId
        },
        role: {
            type: String,
            enum: ['admin', 'superadmin', 'system']
        }
    },
    headers: {
        type: Object,
        default: {}
    },
    method: {
        type: String,
        enum: ['POST', 'PUT', 'PATCH'],
        default: 'POST'
    },
    format: {
        type: String,
        enum: ['json', 'form', 'xml'],
        default: 'json'
    },
    version: {
        type: String,
        default: 'v1'
    },
    filterConditions: {
        type: Object,
        default: null
    },
    retryConfig: {
        maxRetries: {
            type: Number,
            default: 5
        },
        retryInterval: {
            type: Number,
            default: 60 // seconds
        },
        retryBackoff: {
            type: Boolean,
            default: true
        },
        retryWait: {
            type: Number,
            default: 3600 // Max wait time in seconds (1 hour)
        }
    },
    eventHistory: [webhookEventSchema],
    status: {
        type: String,
        enum: ['active', 'paused', 'failing', 'inactive'],
        default: 'active'
    },
    healthCheck: {
        lastSuccess: {
            type: Date,
            default: null
        },
        lastFailure: {
            type: Date,
            default: null
        },
        consecutiveFailures: {
            type: Number,
            default: 0
        },
        uptimePercentage: {
            type: Number,
            default: 100
        }
    },
    rateLimiting: {
        enabled: {
            type: Boolean,
            default: false
        },
        requestsPerMinute: {
            type: Number,
            default: 60
        },
        currentMinuteRequests: {
            type: Number,
            default: 0
        },
        lastResetAt: {
            type: Date,
            default: Date.now
        }
    },
    tags: [{
        type: String
    }]
}, {
    timestamps: true
});

// Add indexes for faster queries
webhookSchema.index({ adminId: 1, isActive: 1 });
webhookSchema.index({ superAdminId: 1, isActive: 1 });
webhookSchema.index({ events: 1, isActive: 1 });
webhookSchema.index({ status: 1 });
webhookSchema.index({ 'eventHistory.eventId': 1 });
webhookSchema.index({ 'eventHistory.status': 1, 'eventHistory.nextAttemptAt': 1 });

// Static method to find webhooks for a specific event
webhookSchema.statics.findForEvent = async function(eventType, context = {}) {
    // Find active webhooks that are subscribed to this event
    const webhooks = await this.find({
        isActive: true,
        status: 'active',
        $or: [
            { events: eventType },
            { events: 'system.*' } // Wildcard for all system events
        ]
    });
    
    // Apply additional filters if specified
    if (context) {
        return webhooks.filter(webhook => {
            if (!webhook.filterConditions) return true;
            
            try {
                const filter = webhook.filterConditions;
                
                // Simple filter evaluation (can be enhanced for more complex conditions)
                for (const key in filter) {
                    if (Object.prototype.hasOwnProperty.call(filter, key)) {
                        const condition = filter[key];
                        
                        // Skip if the context doesn't have this property
                        if (!Object.prototype.hasOwnProperty.call(context, key)) {
                            return false;
                        }
                        
                        // Simple equality check
                        if (condition === context[key]) {
                            continue;
                        }
                        
                        // Object condition with operators
                        if (typeof condition === 'object') {
                            if (condition.$eq !== undefined && condition.$eq !== context[key]) {
                                return false;
                            }
                            if (condition.$ne !== undefined && condition.$ne === context[key]) {
                                return false;
                            }
                            if (condition.$in !== undefined && !condition.$in.includes(context[key])) {
                                return false;
                            }
                            if (condition.$nin !== undefined && condition.$nin.includes(context[key])) {
                                return false;
                            }
                            // Add more operators as needed
                        } else if (condition !== context[key]) {
                            return false;
                        }
                    }
                }
                
                return true;
            } catch (error) {
                console.error('Error evaluating webhook filter:', error);
                return false;
            }
        });
    }
    
    return webhooks;
};

// Method to add an event to history
webhookSchema.methods.addEvent = async function(event) {
    const eventObj = {
        eventId: event.eventId || crypto.randomBytes(16).toString('hex'),
        eventType: event.eventType,
        payload: event.payload,
        status: 'pending',
        createdAt: new Date()
    };
    
    // Check rate limiting
    if (this.rateLimiting.enabled) {
        const now = new Date();
        const minuteDiff = (now - this.rateLimiting.lastResetAt) / (1000 * 60);
        
        if (minuteDiff >= 1) {
            // Reset counter if more than a minute has passed
            this.rateLimiting.currentMinuteRequests = 1;
            this.rateLimiting.lastResetAt = now;
        } else if (this.rateLimiting.currentMinuteRequests >= this.rateLimiting.requestsPerMinute) {
            // Rate limit exceeded
            eventObj.status = 'failed';
            eventObj.error = {
                message: 'Rate limit exceeded',
                code: 'RATE_LIMIT_EXCEEDED'
            };
        } else {
            // Increment counter
            this.rateLimiting.currentMinuteRequests += 1;
        }
    }
    
    // Add to history and update fields
    this.eventHistory.unshift(eventObj);
    
    // Limit history size to prevent document from growing too large
    if (this.eventHistory.length > 100) {
        this.eventHistory = this.eventHistory.slice(0, 100);
    }
    
    await this.save();
    return eventObj;
};

// Method to update event status
webhookSchema.methods.updateEventStatus = async function(eventId, updateData) {
    const eventIndex = this.eventHistory.findIndex(e => e.eventId === eventId);
    
    if (eventIndex === -1) {
        throw new Error(`Event with ID ${eventId} not found`);
    }
    
    // Update event fields
    Object.assign(this.eventHistory[eventIndex], updateData);
    
    // Update webhook health check metrics
    if (updateData.status === 'success') {
        this.healthCheck.lastSuccess = new Date();
        this.healthCheck.consecutiveFailures = 0;
    } else if (updateData.status === 'failed') {
        this.healthCheck.lastFailure = new Date();
        this.healthCheck.consecutiveFailures += 1;
        
        // If too many consecutive failures, change webhook status
        if (this.healthCheck.consecutiveFailures >= 5) {
            this.status = 'failing';
        }
    }
    
    // Calculate uptime percentage (based on last 100 events)
    const totalEvents = Math.min(this.eventHistory.length, 100);
    if (totalEvents > 0) {
        const successfulEvents = this.eventHistory
            .slice(0, 100)
            .filter(e => e.status === 'success')
            .length;
        
        this.healthCheck.uptimePercentage = (successfulEvents / totalEvents) * 100;
    }
    
    await this.save();
    return this.eventHistory[eventIndex];
};

// Generate HMAC signature for payload verification
webhookSchema.methods.generateSignature = function(payload) {
    return crypto
        .createHmac('sha256', this.secret)
        .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
        .digest('hex');
};

const Webhook = mongoose.model('Webhooks', webhookSchema);
module.exports = { Webhook };