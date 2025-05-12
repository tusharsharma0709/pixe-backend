// models/Feedbacks.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
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
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        default: null
    },
    type: {
        type: String,
        enum: ['customer_satisfaction', 'agent_performance', 'workflow_experience', 'product_feedback', 'app_experience', 'other'],
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    comment: {
        type: String,
        default: null
    },
    targetType: {
        type: String,
        enum: ['agent', 'admin', 'workflow', 'product', 'campaign', 'system', 'app', 'order', 'service'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    source: {
        type: String,
        enum: ['whatsapp', 'app', 'web', 'sms', 'email', 'manual'],
        default: 'whatsapp'
    },
    status: {
        type: String,
        enum: ['new', 'reviewed', 'responded', 'resolved', 'ignored'],
        default: 'new'
    },
    tags: [{
        type: String
    }],
    sentiment: {
        score: {
            type: Number,
            min: -1,
            max: 1,
            default: null
        },
        label: {
            type: String,
            enum: ['positive', 'negative', 'neutral', null],
            default: null
        },
        keywords: [{
            type: String
        }]
    },
    category: {
        type: String,
        default: null
    },
    subCategory: {
        type: String,
        default: null
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    assignedToRole: {
        type: String,
        enum: ['admin', 'agent', 'superadmin', null],
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    response: {
        text: {
            type: String,
            default: null
        },
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        respondedAt: {
            type: Date,
            default: null
        },
        respondedByRole: {
            type: String,
            enum: ['admin', 'agent', 'superadmin', 'system', null],
            default: null
        }
    },
    metadata: {
        type: Object,
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    images: [{
        type: String  // URLs to feedback images if any
    }],
    isAnonymous: {
        type: Boolean,
        default: false
    },
    userInfo: {
        name: {
            type: String,
            default: null
        },
        email: {
            type: String,
            default: null
        },
        phone: {
            type: String,
            default: null
        }
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ adminId: 1 });
feedbackSchema.index({ agentId: 1 });
feedbackSchema.index({ sessionId: 1 });
feedbackSchema.index({ targetType: 1, targetId: 1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ rating: 1, targetType: 1 });
feedbackSchema.index({ 'sentiment.label': 1, createdAt: -1 });
feedbackSchema.index({ priority: 1, status: 1 });
feedbackSchema.index({ assignedTo: 1, status: 1 });

// Static method to calculate average rating
feedbackSchema.statics.calculateAverageRating = async function(targetType, targetId) {
    const result = await this.aggregate([
        {
            $match: {
                targetType,
                targetId: mongoose.Types.ObjectId(targetId),
                rating: { $ne: null }
            }
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    if (result.length > 0) {
        return {
            averageRating: parseFloat(result[0].averageRating.toFixed(1)),
            count: result[0].count
        };
    }
    
    return {
        averageRating: null,
        count: 0
    };
};

// Static method to get distribution of ratings
feedbackSchema.statics.getRatingDistribution = async function(targetType, targetId) {
    const result = await this.aggregate([
        {
            $match: {
                targetType,
                targetId: mongoose.Types.ObjectId(targetId),
                rating: { $ne: null }
            }
        },
        {
            $group: {
                _id: '$rating',
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);
    
    // Convert to distribution object
    const distribution = {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    
    result.forEach(item => {
        distribution[item._id] = item.count;
    });
    
    return distribution;
};

const Feedback = mongoose.model('Feedbacks', feedbackSchema);
module.exports = { Feedback };