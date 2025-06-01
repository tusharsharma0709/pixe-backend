// models/Verifications.js - Fixed expiresAt duplicate index

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
    // Updated verificationType enum to include all new SurePass types:
    verificationType: {
        type: String,
        enum: [
            // Existing types
            'aadhaar', 
            'aadhaar_otp',
            'pan', 
            'aadhaar_pan_link', 
            'bank_account',
            'chassis_to_rc',
            'company_details',
            'din',
            'fssai',
            'gstin',
            'icai',
            'video_kyc', 
            'email',
            'phone',
            'address',
            'document',
            'business',
            'face_match',
            
            // NEW: 6 additional verification types
            'driving_license',
            'gstin_advanced',
            'gstin_by_pan',
            'udyog_aadhaar',
            'itr_compliance',
            'rc_full_details'
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
        type: mongoose.Schema.Types.Mixed,
        default: null // Data sent to verification provider
    },
    responseData: {
        type: mongoose.Schema.Types.Mixed,
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
        
        // NEW: For Driving License
        licenseNumber: {
            type: String,
            default: null
        },
        licenseName: {
            type: String,
            default: null
        },
        licenseState: {
            type: String,
            default: null
        },
        licenseDob: {
            type: String,
            default: null
        },
        licenseDoe: {
            type: String,
            default: null
        },
        vehicleClasses: {
            type: [String],
            default: []
        },
        permanentAddress: {
            type: String,
            default: null
        },
        temporaryAddress: {
            type: String,
            default: null
        },
        fatherOrHusbandName: {
            type: String,
            default: null
        },
        bloodGroup: {
            type: String,
            default: null
        },
        
        // NEW: For GSTIN Advanced
        gstinNumber: {
            type: String,
            default: null
        },
        businessName: {
            type: String,
            default: null
        },
        legalName: {
            type: String,
            default: null
        },
        gstinStatus: {
            type: String,
            default: null
        },
        registrationDate: {
            type: String,
            default: null
        },
        taxpayerType: {
            type: String,
            default: null
        },
        constitutionOfBusiness: {
            type: String,
            default: null
        },
        annualTurnover: {
            type: String,
            default: null
        },
        principalBusinessAddress: {
            type: String,
            default: null
        },
        principalEmail: {
            type: String,
            default: null
        },
        principalMobile: {
            type: String,
            default: null
        },
        
        // NEW: For GSTIN by PAN (stores list of GSTINs)
        gstinList: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },
        
        // NEW: For Udyog Aadhaar
        udyamNumber: {
            type: String,
            default: null
        },
        enterpriseName: {
            type: String,
            default: null
        },
        majorActivity: {
            type: String,
            default: null
        },
        enterpriseType: {
            type: String,
            default: null
        },
        dateOfCommencement: {
            type: String,
            default: null
        },
        organizationType: {
            type: String,
            default: null
        },
        socialCategory: {
            type: String,
            default: null
        },
        udyamState: {
            type: String,
            default: null
        },
        udyamCity: {
            type: String,
            default: null
        },
        udyamPin: {
            type: String,
            default: null
        },
        
        // NEW: For ITR Compliance
        panCompliant: {
            type: Boolean,
            default: null
        },
        panAllotmentDate: {
            type: String,
            default: null
        },
        maskedName: {
            type: String,
            default: null
        },
        panAadhaarLinked: {
            type: String,
            default: null
        },
        panStatus: {
            type: String,
            default: null
        },
        validPan: {
            type: Boolean,
            default: null
        },
        specifiedPersonUnder206: {
            type: String,
            default: null
        },
        
        // NEW: For RC Full Details
        rcNumber: {
            type: String,
            default: null
        },
        ownerName: {
            type: String,
            default: null
        },
        rcFatherName: {
            type: String,
            default: null
        },
        vehicleCategory: {
            type: String,
            default: null
        },
        vehicleChasiNumber: {
            type: String,
            default: null
        },
        vehicleEngineNumber: {
            type: String,
            default: null
        },
        makerDescription: {
            type: String,
            default: null
        },
        makerModel: {
            type: String,
            default: null
        },
        bodyType: {
            type: String,
            default: null
        },
        fuelType: {
            type: String,
            default: null
        },
        vehicleColor: {
            type: String,
            default: null
        },
        manufacturingDate: {
            type: String,
            default: null
        },
        rcRegistrationDate: {
            type: String,
            default: null
        },
        financer: {
            type: String,
            default: null
        },
        financed: {
            type: Boolean,
            default: null
        },
        insuranceCompany: {
            type: String,
            default: null
        },
        insurancePolicyNumber: {
            type: String,
            default: null
        },
        insuranceUpto: {
            type: String,
            default: null
        },
        fitUpTo: {
            type: String,
            default: null
        },
        taxUpTo: {
            type: String,
            default: null
        },
        permitNumber: {
            type: String,
            default: null
        },
        permitType: {
            type: String,
            default: null
        },
        permitValidUpto: {
            type: String,
            default: null
        },
        seatCapacity: {
            type: String,
            default: null
        },
        cubicCapacity: {
            type: String,
            default: null
        },
        vehicleGrossWeight: {
            type: String,
            default: null
        },
        unladenWeight: {
            type: String,
            default: null
        },
        rcStatus: {
            type: String,
            default: null
        },
        
        // Name matching details (applies to multiple verification types)
        nameMatch: {
            type: mongoose.Schema.Types.Mixed,
            default: function() {
                return {
                    status: null,
                    score: null,
                    details: {}
                };
            }
        }
    },
    documents: [{
        type: {
            type: String,
            enum: [
                'aadhaar_front', 
                'aadhaar_back', 
                'pan', 
                'driving_license_front',
                'driving_license_back',
                'rc_front',
                'rc_back',
                'selfie', 
                'signature', 
                'bank_statement', 
                'address_proof',
                'gstin_certificate',
                'udyam_certificate',
                'itr_documents',
                'other'
            ],
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
            type: mongoose.Schema.Types.Mixed,
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
        // REMOVED: index: true - will be defined in schema.index() below
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
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired records - MOVED FROM FIELD

// Add indexes for new verification types
verificationSchema.index({ 'verificationDetails.licenseNumber': 1 });
verificationSchema.index({ 'verificationDetails.gstinNumber': 1 });
verificationSchema.index({ 'verificationDetails.udyamNumber': 1 });
verificationSchema.index({ 'verificationDetails.rcNumber': 1 });

// Add pre-save middleware to ensure proper structure of nested objects
verificationSchema.pre('save', function(next) {
    // Ensure verificationDetails exists
    if (!this.verificationDetails) {
        this.verificationDetails = {};
    }
    
    // Ensure nameMatch is properly structured
    if (this.verificationDetails && this.verificationDetails.nameMatch === undefined) {
        this.verificationDetails.nameMatch = {
            status: null,
            score: null,
            details: {}
        };
    }
    
    next();
});

// Add method to check verification status
verificationSchema.methods.isComplete = function() {
    return this.status === 'completed';
};

// Enhanced method to get a safe version of sensitive data with new fields
verificationSchema.methods.getSafeData = function() {
    const safeData = this.toObject();
    
    // Mask Aadhaar number
    if (safeData.verificationDetails && safeData.verificationDetails.aadhaarNumber) {
        const aadhaar = safeData.verificationDetails.aadhaarNumber;
        safeData.verificationDetails.aadhaarNumber = aadhaar.length >= 12 ? 
            `${aadhaar.substring(0, 4)}XXXX${aadhaar.substring(8)}` : 'XXXXXXXX';
    }
    
    // Mask PAN number
    if (safeData.verificationDetails && safeData.verificationDetails.panNumber) {
        const pan = safeData.verificationDetails.panNumber;
        safeData.verificationDetails.panNumber = pan.length >= 10 ? 
            `${pan.substring(0, 2)}XXXXX${pan.substring(7)}` : 'XXXXXXX';
    }
    
    // Mask Driving License number
    if (safeData.verificationDetails && safeData.verificationDetails.licenseNumber) {
        const license = safeData.verificationDetails.licenseNumber;
        safeData.verificationDetails.licenseNumber = license.length >= 10 ? 
            `${license.substring(0, 3)}XXXX${license.substring(license.length - 3)}` : 'XXXXXXX';
    }
    
    // Mask Account Number
    if (safeData.verificationDetails && safeData.verificationDetails.accountNumber) {
        const account = safeData.verificationDetails.accountNumber;
        safeData.verificationDetails.accountNumber = account.length >= 8 ? 
            `${account.substring(0, 2)}XXXX${account.substring(account.length - 4)}` : 'XXXXXXX';
    }
    
    // Mask Vehicle Engine Number
    if (safeData.verificationDetails && safeData.verificationDetails.vehicleEngineNumber) {
        const engine = safeData.verificationDetails.vehicleEngineNumber;
        safeData.verificationDetails.vehicleEngineNumber = engine.length >= 8 ? 
            `${engine.substring(0, 3)}XXXX${engine.substring(engine.length - 3)}` : 'XXXXXXX';
    }
    
    // Mask Vehicle Chassis Number
    if (safeData.verificationDetails && safeData.verificationDetails.vehicleChasiNumber) {
        const chassis = safeData.verificationDetails.vehicleChasiNumber;
        safeData.verificationDetails.vehicleChasiNumber = chassis.length >= 10 ? 
            `${chassis.substring(0, 4)}XXXX${chassis.substring(chassis.length - 4)}` : 'XXXXXXX';
    }
    
    // Mask GSTIN number (keep first 2 and last 3 characters)
    if (safeData.verificationDetails && safeData.verificationDetails.gstinNumber) {
        const gstin = safeData.verificationDetails.gstinNumber;
        safeData.verificationDetails.gstinNumber = gstin.length >= 15 ? 
            `${gstin.substring(0, 2)}XXXXXXXXXX${gstin.substring(gstin.length - 3)}` : 'XXXXXXXXXXXXXXX';
    }
    
    // Mask mobile numbers in principal contact details
    if (safeData.verificationDetails && safeData.verificationDetails.principalMobile) {
        const mobile = safeData.verificationDetails.principalMobile;
        safeData.verificationDetails.principalMobile = mobile.length >= 10 ? 
            `${mobile.substring(0, 2)}XXXXXX${mobile.substring(mobile.length - 2)}` : 'XXXXXXXXXX';
    }
    
    return safeData;
};

// Add static method to get verification summary by type (enhanced)
verificationSchema.statics.getVerificationSummary = async function(userId, verificationType = null) {
    const query = { userId };
    if (verificationType) query.verificationType = verificationType;
    
    const summary = await this.aggregate([
        { $match: query },
        {
            $group: {
                _id: '$verificationType',
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                lastVerification: { $max: '$createdAt' }
            }
        }
    ]);
    
    return summary;
};

// Add static method to check if user has completed specific verification
verificationSchema.statics.hasCompletedVerification = async function(userId, verificationType) {
    const verification = await this.findOne({
        userId,
        verificationType,
        status: 'completed'
    });
    
    return !!verification;
};

// Add static method to get all verifications for a user with details
verificationSchema.statics.getUserVerifications = async function(userId, includeDetails = false) {
    const query = this.find({ userId }).sort({ createdAt: -1 });
    
    if (!includeDetails) {
        query.select('-responseData -requestData -verificationAttempts');
    }
    
    return await query.exec();
};

// Add static method to get verification statistics
verificationSchema.statics.getVerificationStats = async function(adminId = null, dateFrom = null, dateTo = null) {
    const matchQuery = {};
    
    if (adminId) matchQuery.adminId = adminId;
    if (dateFrom || dateTo) {
        matchQuery.createdAt = {};
        if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
    }
    
    const stats = await this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: {
                    verificationType: '$verificationType',
                    status: '$status'
                },
                count: { $sum: 1 },
                avgProcessingTime: {
                    $avg: {
                        $subtract: ['$completedAt', '$startedAt']
                    }
                }
            }
        },
        {
            $group: {
                _id: '$_id.verificationType',
                statusBreakdown: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        avgProcessingTime: '$avgProcessingTime'
                    }
                },
                totalCount: { $sum: '$count' }
            }
        }
    ]);
    
    return stats;
};

// Instance method to mark verification as completed
verificationSchema.methods.markCompleted = function(responseData = null) {
    this.status = 'completed';
    this.completedAt = new Date();
    if (responseData) this.responseData = responseData;
    return this.save();
};

// Instance method to mark verification as failed
verificationSchema.methods.markFailed = function(reason = null, responseData = null) {
    this.status = 'failed';
    this.rejectionReason = reason;
    if (responseData) this.responseData = responseData;
    return this.save();
};

const Verification = mongoose.model('Verifications', verificationSchema);
module.exports = { Verification };