// models/Calls.js - Call model for storing call records

const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    // Exotel identifiers
    callSid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Admin who initiated the call
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true,
        index: true
    },
    
    // User involved in the call (optional)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    
    // Call details
    fromNumber: {
        type: String,
        required: true,
        index: true
    },
    
    toNumber: {
        type: String,
        required: true,
        index: true
    },
    
    callerId: {
        type: String,
        required: true
    },
    
    direction: {
        type: String,
        enum: ['inbound', 'outbound'],
        default: 'outbound',
        index: true
    },
    
    status: {
        type: String,
        enum: [
            'initiated', 'ringing', 'in-progress', 'completed', 
            'failed', 'busy', 'no-answer', 'canceled'
        ],
        default: 'initiated',
        index: true
    },
    
    // Call timing
    startTime: {
        type: Date,
        default: Date.now
    },
    
    endTime: {
        type: Date
    },
    
    duration: {
        type: String // Duration in seconds (Exotel format)
    },
    
    // Call metadata
    answeredBy: {
        type: String,
        enum: ['human', 'machine', null]
    },
    
    callType: {
        type: String
    },
    
    // Recording details
    recordingEnabled: {
        type: Boolean,
        default: false
    },
    
    recordingUrl: {
        type: String
    },
    
    recordingSid: {
        type: String
    },
    
    recordingDuration: {
        type: String
    },
    
    // Custom fields for business logic
    customFields: {
        customField1: String,
        customField2: String
    },
    
    // Raw Exotel API response
    exotelData: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // Workflow integration
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        index: true
    },
    
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        index: true
    },
    
    // Call purpose/category
    purpose: {
        type: String,
        enum: ['support', 'sales', 'verification', 'follow-up', 'marketing', 'other'],
        default: 'other'
    },
    
    tags: [{
        type: String,
        trim: true
    }],
    
    // Call notes and comments
    notes: {
        type: String,
        maxlength: 1000
    },
    
    // Call outcome/result
    outcome: {
        type: String,
        enum: ['successful', 'unsuccessful', 'callback_required', 'voicemail', 'pending'],
        index: true
    },
    
    // Follow-up information
    followUpRequired: {
        type: Boolean,
        default: false
    },
    
    followUpDate: {
        type: Date
    },
    
    followUpNotes: {
        type: String,
        maxlength: 500
    },
    
    // Integration with other systems
    relatedTo: {
        model: {
            type: String,
            enum: ['Users', 'Campaigns', 'Leads', 'Tickets']
        },
        id: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    
    // Call cost (if available from Exotel)
    cost: {
        amount: Number,
        currency: {
            type: String,
            default: 'INR'
        }
    },
    
    // Error handling
    errorDetails: {
        type: String
    },
    
    retryCount: {
        type: Number,
        default: 0
    },
    
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    
    deletedAt: {
        type: Date
    },
    
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins'
    }

}, {
    timestamps: true,
    collection: 'calls'
});

// Indexes for better query performance
callSchema.index({ adminId: 1, createdAt: -1 });
callSchema.index({ fromNumber: 1, toNumber: 1 });
callSchema.index({ status: 1, createdAt: -1 });
callSchema.index({ workflowId: 1, sessionId: 1 });
callSchema.index({ purpose: 1, outcome: 1 });
callSchema.index({ followUpRequired: 1, followUpDate: 1 });

// Virtual fields
callSchema.virtual('durationInSeconds').get(function() {
    return this.duration ? parseInt(this.duration) : 0;
});

callSchema.virtual('durationFormatted').get(function() {
    const seconds = this.durationInSeconds;
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
});

callSchema.virtual('isCompleted').get(function() {
    return this.status === 'completed';
});

callSchema.virtual('hasRecording').get(function() {
    return !!(this.recordingUrl && this.recordingSid);
});

callSchema.virtual('callDurationMs').get(function() {
    if (this.startTime && this.endTime) {
        return this.endTime.getTime() - this.startTime.getTime();
    }
    return 0;
});

// Instance methods
callSchema.methods.markAsCompleted = function() {
    this.status = 'completed';
    this.endTime = new Date();
    return this.save();
};

callSchema.methods.markAsFailed = function(errorDetails = null) {
    this.status = 'failed';
    this.endTime = new Date();
    if (errorDetails) {
        this.errorDetails = errorDetails;
    }
    return this.save();
};

callSchema.methods.addNote = function(note) {
    if (this.notes) {
        this.notes += `\n${new Date().toISOString()}: ${note}`;
    } else {
        this.notes = `${new Date().toISOString()}: ${note}`;
    }
    return this.save();
};

callSchema.methods.setFollowUp = function(date, notes = '') {
    this.followUpRequired = true;
    this.followUpDate = date;
    this.followUpNotes = notes;
    return this.save();
};

callSchema.methods.markFollowUpComplete = function() {
    this.followUpRequired = false;
    this.followUpDate = null;
    this.followUpNotes = '';
    return this.save();
};

callSchema.methods.softDelete = function(deletedBy = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (deletedBy) {
        this.deletedBy = deletedBy;
    }
    return this.save();
};

// Static methods
callSchema.statics.findActive = function() {
    return this.find({ 
        isDeleted: false,
        status: { $in: ['initiated', 'ringing', 'in-progress'] }
    });
};

callSchema.statics.findByAdmin = function(adminId, filters = {}) {
    return this.find({ 
        adminId, 
        isDeleted: false,
        ...filters 
    });
};

callSchema.statics.findWithRecordings = function(filters = {}) {
    return this.find({ 
        recordingUrl: { $exists: true, $ne: null },
        isDeleted: false,
        ...filters 
    });
};

callSchema.statics.getCallStats = function(adminId, startDate = null, endDate = null) {
    const match = { adminId, isDeleted: false };
    
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                completedCalls: {
                    $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                },
                failedCalls: {
                    $sum: { $cond: [{ $in: ["$status", ["failed", "busy", "no-answer"]] }, 1, 0] }
                },
                recordedCalls: {
                    $sum: { $cond: [{ $ne: ["$recordingUrl", null] }, 1, 0] }
                },
                totalDuration: {
                    $sum: { 
                        $cond: [
                            { $ne: ["$duration", null] }, 
                            { $toInt: "$duration" }, 
                            0
                        ]
                    }
                },
                avgDuration: {
                    $avg: { 
                        $cond: [
                            { $ne: ["$duration", null] }, 
                            { $toInt: "$duration" }, 
                            null
                        ]
                    }
                }
            }
        }
    ]);
};

// Pre-save middleware
callSchema.pre('save', function(next) {
    // Auto-calculate duration if start and end times are available
    if (this.startTime && this.endTime && !this.duration) {
        const durationMs = this.endTime.getTime() - this.startTime.getTime();
        this.duration = Math.floor(durationMs / 1000).toString();
    }
    
    // Set end time for completed/failed calls
    if (['completed', 'failed', 'busy', 'no-answer'].includes(this.status) && !this.endTime) {
        this.endTime = new Date();
    }
    
    next();
});

// Post-save middleware for logging
callSchema.post('save', function(doc) {
    console.log(`📞 Call ${doc.callSid} saved with status: ${doc.status}`);
});

// Export model
const Call = mongoose.model('Call', callSchema);
module.exports = { Call };