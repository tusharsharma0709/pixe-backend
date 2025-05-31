// models/Users.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    email_id: {
        type: String,
        trim: true
    },
    phone: { 
        type: String, 
        required: true,
        unique: true,
        trim: true
    },
    otp: { 
        type: String, 
        default: null 
    },
    otpExpiresAt: { 
        type: Date, 
        default: null 
    }, 
    isOtpVerified: { 
        type: Boolean,
        default: false 
    },
    isPanVerified: {
        type: Boolean,
        default: false
    },
    isAadhaarVerified: {
        type: Boolean,
        default: false
    },
    isAadhaarValidated: {
        type: Boolean,
        default: false
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Products',
        default: null
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    assignedAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null
    },
    status: {
        type: String,
        enum: ['new', 'active', 'qualified', 'processing', 'converted', 'closed', 'inactive'],
        default: 'new'
    },
    source: {
        type: String,
        enum: ['whatsapp', 'web', 'api', 'import', 'facebook'], // Added new options
        default: 'facebook'
    },
    fullName: {
        type: String,
        trim: true,
        default: function() {
            return this.name; // Use name as fallback
        }
    },
    whatsappProfile: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    firstMessageAt: {
        type: Date,
        default: null
    },
    lastInteractionAt: {
        type: Date,
        default: Date.now
    },
    stage: {
        type: String,
        default: null
    },
    leadScore: {
        type: Number,
        default: 0
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        default: null
    },
    tags: [{
        type: String
    }],
    meta: {
        type: Object,
        default: {} // For storing additional user information
    },
    facebookUserData: {
        type: Object,
        default: null // Facebook user data if available
    },
    communicationPreferences: {
        whatsapp: {
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
        }
    }
}, {
    timestamps: true
});

// Add indexes for faster queries - removed duplicate phone index
userSchema.index({ campaignId: 1, status: 1 });
userSchema.index({ adminId: 1, status: 1 });
userSchema.index({ assignedAgent: 1, status: 1 });
userSchema.index({ lastActivityAt: -1 });

const User = mongoose.model('Users', userSchema);
module.exports = { User };