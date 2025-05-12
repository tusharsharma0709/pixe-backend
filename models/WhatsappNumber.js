// models/WhatsappNumbers.js
const mongoose = require('mongoose');

const whatsappNumberSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    businessName: {
        type: String,
        trim: true
    },
    wabaidId: {
        type: String,  // WhatsApp Business Account ID
        default: null
    },
    phoneNumberId: {
        type: String, // WhatsApp Phone Number ID
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending_approval'],
        default: 'pending_approval'
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    assignedAt: {
        type: Date,
        default: null
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    qrCode: {
        type: String,
        default: null
    },
    verified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    accessToken: {
        type: String,
        default: null
    },
    tokenExpiresAt: {
        type: Date,
        default: null
    },
    refreshToken: {
        type: String,
        default: null
    },
    capacity: {
        maxChats: {
            type: Number,
            default: 1000
        },
        maxMessagesPerDay: {
            type: Number,
            default: 10000
        },
        currentChats: {
            type: Number,
            default: 0
        },
        todayMessages: {
            type: Number,
            default: 0
        }
    },
    businessProfile: {
        address: {
            type: String,
            default: null
        },
        description: {
            type: String,
            default: null
        },
        email: {
            type: String,
            default: null
        },
        websites: [{
            type: String
        }],
        vertical: {
            type: String,
            default: null
        }
    },
    qualityRating: {
        type: String,
        enum: ['green', 'yellow', 'red', null],
        default: null
    },
    messagingLimit: {
        type: String,
        enum: ['no_limit', 'restricted', 'blocked', null],
        default: null
    },
    templates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsappTemplates'
    }],
    settings: {
        autoReply: {
            enabled: {
                type: Boolean,
                default: false
            },
            message: {
                type: String,
                default: null
            },
            triggers: [{
                keyword: String,
                response: String
            }]
        },
        offHours: {
            enabled: {
                type: Boolean,
                default: false
            },
            message: {
                type: String,
                default: null
            },
            schedule: {
                type: Object,
                default: null
            }
        },
        greetingMessage: {
            type: String,
            default: null
        },
        notificationEmail: {
            type: String,
            default: null
        },
        defaultTemplate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WhatsappTemplates',
            default: null
        }
    },
    metrics: {
        totalMessages: {
            type: Number,
            default: 0
        },
        totalUsers: {
            type: Number,
            default: 0
        },
        averageResponseTime: {
            type: Number,
            default: 0
        },
        dailyActiveUsers: {
            type: Number,
            default: 0
        },
        weeklyActiveUsers: {
            type: Number,
            default: 0
        },
        monthlyActiveUsers: {
            type: Number,
            default: 0
        }
    },
    webhook: {
        url: {
            type: String,
            default: null
        },
        secret: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'failed'],
            default: 'inactive'
        },
        lastFailure: {
            timestamp: {
                type: Date,
                default: null
            },
            error: {
                type: String,
                default: null
            }
        }
    },
    notes: {
        type: String,
        default: null
    },
    tags: [{
        type: String
    }],
    lastSync: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries - removed duplicate phoneNumber index
whatsappNumberSchema.index({ adminId: 1, status: 1 });
whatsappNumberSchema.index({ superAdminId: 1, status: 1 });
whatsappNumberSchema.index({ status: 1, 'capacity.currentChats': 1 });
whatsappNumberSchema.index({ status: 1, qualityRating: 1 });
whatsappNumberSchema.index({ wabaidId: 1 });

// Static method to find an available number for assignment
whatsappNumberSchema.statics.findAvailableNumber = async function() {
    return await this.findOne({
        adminId: null,
        status: 'active',
        verified: true
    }).sort({ 'capacity.currentChats': 1 });
};

// Static method to update capacity metrics
whatsappNumberSchema.statics.updateCapacity = async function(phoneNumber, updates) {
    const number = await this.findOne({ phoneNumber });
    
    if (!number) {
        throw new Error(`WhatsApp number ${phoneNumber} not found.`);
    }
    
    if (updates.addChat) {
        number.capacity.currentChats += 1;
    }
    
    if (updates.removeChat) {
        number.capacity.currentChats = Math.max(0, number.capacity.currentChats - 1);
    }
    
    if (updates.addMessages) {
        number.capacity.todayMessages += (updates.addMessages || 1);
        number.metrics.totalMessages += (updates.addMessages || 1);
    }
    
    await number.save();
    return number;
};

// Instance method to check capacity limits
whatsappNumberSchema.methods.hasCapacity = function() {
    return (
        this.capacity.currentChats < this.capacity.maxChats &&
        this.capacity.todayMessages < this.capacity.maxMessagesPerDay
    );
};

// Middleware to reset daily message count at midnight
if (process.env.NODE_ENV !== 'test') {
    const resetDailyMessageCount = async () => {
        const now = new Date();
        
        // Only run at midnight
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            try {
                await mongoose.model('WhatsappNumbers').updateMany(
                    {},
                    { 'capacity.todayMessages': 0 }
                );
                console.log('Reset WhatsApp daily message counts.');
            } catch (error) {
                console.error('Failed to reset WhatsApp message counts:', error);
            }
        }
    };
    
    // Schedule the reset to run every hour
    setInterval(resetDailyMessageCount, 60 * 60 * 1000);
}

const WhatsappNumber = mongoose.model('WhatsappNumbers', whatsappNumberSchema);
module.exports = { WhatsappNumber };