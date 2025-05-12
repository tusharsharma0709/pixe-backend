// models/Verifications.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
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
    verificationType: {
        type: String,
        enum: [
            'aadhaar', 
            'pan', 
            'aadhaar_pan_link', 
            'bank_account', 
            'video_kyc', 
            'email',
            'phone',
            'address',
            'document',
            'business',
            'face_match'
        ],
        required: true
    },
    mode: {
        type: String,
        enum: ['auto', 'manual', 'agent_assisted', 'api'],
        default: 'auto'
    },
    provider: {
        type: String,
        enum: ['surepass', 'digio', 'karza', 'internal', 'other'],
        default: 'surepass'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed', 'rejected', 'expired'],
        default: 'pending'
    },
    referenceId: {
        type: String,
        default: null // Provider's reference ID
    },
    requestData: {
        type: Object,
        default: null // Data sent to verification provider
    },
    responseData: {
        type: Object,
        default: null // Data received from verification provider
    },
    verificationDetails: {
        // For Aadhaar
        aadhaarNumber: {
            type: String,
            default: null
        },
        aadhaarName: {
            type: String,
            default: null
        },
        aadhaarDob: {
            type: String,
            default: null
        },
        aadhaarGender: {
            type: String,
            default: null
        },
        aadhaarAddress: {
            type: String,
            default: null
        },
        // For PAN
        panNumber: {
            type: String,
            default: null
        },
        panName: {
            type: String,
            default: null
        },
        panFatherName: {
            type: String,
            default: null
        },
        // For Bank Account
        accountNumber: {
            type: String,
            default: null
        },
        ifscCode: {
            type: String,
            default: null
        },
        bankName: {
            type: String,
            default: null
        },
        accountHolderName: {
            type: String,
            default: null
        },
        // Generic fields
        nameMatch: {
            status: {
                type: Boolean,
                default: null
            },
            score: {
                type: Number,
                default: null
            },
            details: {
                type: Object,
                default: null
            }
        }
    },
    documents: [{
        type: {
            type: String,
            enum: ['aadhaar_front', 'aadhaar_back', 'pan', 'selfie', 'signature', 'bank_statement', 'address_proof', 'other'],
            required: true
        },
        url: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        rejectionReason: {
            type: String,
            default: null
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agents',
            default: null
        }
    }],
    verificationAttempts: [{
        attemptedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['success', 'failure'],
            required: true
        },
        reason: {
            type: String,
            default: null
        },
        data: {
            type: Object,
            default: null
        }
    }],
    otp: {
        value: {
            type: String,
            default: null
        },
        sentAt: {
            type: Date,
            default: null
        },
        expiresAt: {
            type: Date,
            default: null
        },
        verifiedAt: {
            type: Date,
            default: null
        },
        attempts: {
            type: Number,
            default: 0
        }
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        }
    },
    notes: {
        type: String,
        default: null
    },
    rejectionReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
verificationSchema.index({ userId: 1, verificationType: 1, status: 1 });
verificationSchema.index({ adminId: 1, verificationType: 1, status: 1 });
verificationSchema.index({ agentId: 1, status: 1 });
verificationSchema.index({ status: 1, verificationType: 1, createdAt: -1 });
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired records

const Verification = mongoose.model('Verifications', verificationSchema);
module.exports = { Verification };