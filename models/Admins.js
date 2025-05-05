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
    }
});

const adminSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    mobile: {
        type: Number,
        required: true
    },
    email_id: {
        type: String,
        unique: true,
        required: true
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
        type: String,
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
    }
}, {
    timestamps: true
});

const Admin = mongoose.model("Admins", adminSchema);
module.exports = { Admin };