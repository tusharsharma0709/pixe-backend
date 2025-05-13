// models/Admins.js
const mongoose = require('mongoose');

const facebookAppSchema = new mongoose.Schema({
    appId: {
        type: String,
        required: true
    },
    appSecret: {
        type: String,
        required: true
    },
    appName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'active'
    },
    createdBySuper: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const whatsappVerificationSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    phoneNumberId: {
        type: String,
        default: null
    },
    businessAccountId: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins'
    },
    verifiedAt: {
        type: Date
    },
    lastChecked: {
        type: Date
    }
});

const adminSchema = new mongoose.Schema({
    // Basic Information
    first_name: {
        type: String,
        required: true,
        trim: true
    },
    last_name: {
        type: String,
        required: true,
        trim: true
    },
    business_name: {
        type: String,
        trim: true
    },
    mobile: {
        type: Number,
        required: true,
        unique: true
    },
    email_id: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    
    // Facebook Credentials
    fb_id: {
        type: String,
        required: true
    },
    fb_password: {
        type: String,
        required: true
    },
    fb_credentials_verified: {
        type: Boolean,
        default: false
    },
    fb_verification_date: {
        type: Date
    },
    
    // WhatsApp Configuration (provided during registration)
    requestedWhatsappNumber: {
        type: String,
        required: true
    },
    
    // Facebook App Details (created by super admin)
    facebookApp: {
        type: facebookAppSchema,
        default: null
    },
    
    // WhatsApp Verification (done by super admin)
    whatsappVerification: {
        type: whatsappVerificationSchema,
        default: null
    },
    
    // Admin Status
    status: {
        type: Boolean,
        default: false  // Admin remains inactive until approved by super admin
    },
    approvalStage: {
        type: String,
        enum: ['pending_review', 'fb_verified', 'app_created', 'whatsapp_verified', 'approved', 'rejected'],
        default: 'pending_review'
    },
    
    // Super Admin Actions
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins'
    },
    reviewedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        default: null
    },
    superAdminNotes: {
        type: String,
        default: null
    },
    
    // Auto-approved or requires manual review
    requiresManualReview: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes - only define compound indexes, as unique fields already create indexes
adminSchema.index({ approvalStage: 1, status: 1 });
adminSchema.index({ createdAt: -1 });
adminSchema.index({ 'whatsappVerification.isVerified': 1, status: 1 });

// Virtual for full name
adminSchema.virtual('fullName').get(function() {
    return `${this.first_name} ${this.last_name}`;
});

// Method to check if admin is fully approved
adminSchema.methods.isFullyApproved = function() {
    return this.status === true && this.approvalStage === 'approved';
};

// Method to get approval progress
adminSchema.methods.getApprovalProgress = function() {
    const stages = ['pending_review', 'fb_verified', 'app_created', 'whatsapp_verified', 'approved'];
    const currentIndex = stages.indexOf(this.approvalStage);
    const totalStages = stages.length - 1; // Excluding 'approved' as it's the final state
    return {
        currentStage: this.approvalStage,
        completedStages: currentIndex,
        totalStages: totalStages,
        percentage: Math.round((currentIndex / totalStages) * 100),
        isCompleted: this.approvalStage === 'approved',
        isRejected: this.approvalStage === 'rejected'
    };
};

// Pre-save middleware to handle stage transitions
adminSchema.pre('save', function(next) {
    if (this.isModified('approvalStage')) {
        // If moving to 'approved' stage, activate the admin
        if (this.approvalStage === 'approved') {
            this.status = true;
        }
        
        // If rejected at any stage, deactivate the admin
        if (this.approvalStage === 'rejected') {
            this.status = false;
        }
    }
    next();
});

// toJSON transformation to exclude sensitive data
adminSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.fb_password;
        if (ret.facebookApp) {
            delete ret.facebookApp.appSecret;
        }
        return ret;
    }
});

const Admin = mongoose.model("Admins", adminSchema);
module.exports = { Admin };