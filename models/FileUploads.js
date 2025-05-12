// models/FileUploads.js
const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalFilename: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    uploadedBy: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'agent', 'user', 'superadmin', 'system'],
            required: true
        }
    },
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
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    entityType: {
        type: String,
        enum: [
            'user_profile', 'product', 'campaign', 'admin_profile', 'agent_profile', 
            'verification', 'message', 'order', 'payment', 'feedback', 'chat', 'other'
        ],
        default: 'other'
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    status: {
        type: String,
        enum: ['temporary', 'permanent', 'deleted'],
        default: 'permanent'
    },
    expiresAt: {
        type: Date,
        default: null
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    bucket: {
        type: String,
        default: 'default'
    },
    storageProvider: {
        type: String,
        enum: ['local', 's3', 'cloudinary', 'google_cloud', 'azure', 'other'],
        default: 's3'
    },
    storageMetadata: {
        type: Object,
        default: null
    },
    tags: [{
        type: String
    }],
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    isScanRequired: {
        type: Boolean,
        default: false
    },
    scanStatus: {
        type: String,
        enum: ['pending', 'scanning', 'clean', 'infected', 'error', null],
        default: null
    },
    scanResult: {
        type: Object,
        default: null
    },
    scanDate: {
        type: Date,
        default: null
    },
    isCompressed: {
        type: Boolean,
        default: false
    },
    originalSize: {
        type: Number,
        default: null
    },
    compressedAt: {
        type: Date,
        default: null
    },
    imageMetadata: {
        width: Number,
        height: Number,
        format: String,
        hasAlpha: Boolean,
        colorSpace: String,
        orientation: Number,
        hasExif: Boolean
    },
    documentMetadata: {
        pageCount: Number,
        author: String,
        creationDate: Date,
        modificationDate: Date,
        isEncrypted: Boolean,
        isProtected: Boolean
    },
    accessLog: [{
        accessedBy: {
            id: mongoose.Schema.Types.ObjectId,
            role: String
        },
        accessedAt: {
            type: Date,
            default: Date.now
        },
        ipAddress: String,
        userAgent: String
    }],
    accessCount: {
        type: Number,
        default: 0
    },
    lastAccessed: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
fileUploadSchema.index({ userId: 1, entityType: 1 });
fileUploadSchema.index({ adminId: 1, entityType: 1 });
fileUploadSchema.index({ agentId: 1, entityType: 1 });
fileUploadSchema.index({ entityType: 1, entityId: 1 });
fileUploadSchema.index({ 'uploadedBy.id': 1, 'uploadedBy.role': 1 });
fileUploadSchema.index({ status: 1, createdAt: -1 });
fileUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-delete
fileUploadSchema.index({ isPublic: 1, entityType: 1 });
fileUploadSchema.index({ url: 1 });

// Pre-save middleware to set expiresAt for temporary uploads
fileUploadSchema.pre('save', function(next) {
    if (this.status === 'temporary' && !this.expiresAt) {
        // Set default expiry to 24 hours from now
        this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    next();
});

// Method to log file access
fileUploadSchema.methods.logAccess = async function(accessData) {
    this.accessCount += 1;
    this.lastAccessed = new Date();
    
    this.accessLog.push({
        accessedBy: accessData.accessedBy,
        accessedAt: new Date(),
        ipAddress: accessData.ipAddress,
        userAgent: accessData.userAgent
    });
    
    // Limit the size of the access log array
    if (this.accessLog.length > 100) {
        this.accessLog = this.accessLog.slice(-100);
    }
    
    await this.save();
};

// Static method to find files by entity
fileUploadSchema.statics.findByEntity = async function(entityType, entityId) {
    return this.find({
        entityType,
        entityId,
        status: { $ne: 'deleted' }
    }).sort({ createdAt: -1 });
};

// Static method to mark files as permanent
fileUploadSchema.statics.makePermanent = async function(fileIds) {
    if (!Array.isArray(fileIds)) {
        fileIds = [fileIds];
    }
    
    return this.updateMany(
        { _id: { $in: fileIds } },
        { 
            $set: { 
                status: 'permanent',
                expiresAt: null
            } 
        }
    );
};

// Static method to mark files as deleted (soft delete)
fileUploadSchema.statics.markAsDeleted = async function(fileIds) {
    if (!Array.isArray(fileIds)) {
        fileIds = [fileIds];
    }
    
    return this.updateMany(
        { _id: { $in: fileIds } },
        { $set: { status: 'deleted' } }
    );
};

const FileUpload = mongoose.model('FileUploads', fileUploadSchema);
module.exports = { FileUpload };