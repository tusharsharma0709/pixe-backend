// models/Admins.js
const mongoose = require('mongoose');

const adminAccessSchema = new mongoose.Schema({
    accessToken: {
        type: String
    },
    refreshToken: {
        type: String
    },
    expiresAt: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    lastVerified: {
        type: Date
    }
});

const whatsappNumberSchema = new mongoose.Schema({
    number: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    assignedAt: {
        type: Date,
        default: Date.now
    }
});

const adminSchema = new mongoose.Schema({
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
        required: true
    },
    email_id: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    fb_id: {
        type: String,
        default: null
    },
    fb_password: {
        type: String,
        default: null
    },
    whatsappNumber: {
        type: whatsappNumberSchema,
        default: null
    },
    facebookAccess: {
        type: adminAccessSchema,
        default: () => ({})
    },
    whatsappAccess: {
        type: adminAccessSchema,
        default: () => ({})
    },
    status: {
        type: Boolean,
        default: false  // Admin remains inactive until approved by super admin
    },
    rejectionReason: {
        type: String,
        default: null
    },
    superAdminNotes: {
        type: String,
        default: null
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    approvedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const Admin = mongoose.model("Admins", adminSchema);
module.exports = { Admin };