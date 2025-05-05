// models/UserKYC.js
const mongoose = require('mongoose');

const userKYCSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        unique: true
    },
    aadhaarNumber: {
        type: String
    },
    panNumber: {
        type: String
    },
    aadhaarData: {
        type: String // JSON string of Aadhaar OCR data
    },
    panData: {
        type: String // JSON string of PAN OCR data
    },
    aadhaarClientId: {
        type: String // For Aadhaar OTP verification
    },
    aadhaarValidationData: {
        type: String // JSON string of Aadhaar validation response
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

const UserKYC = mongoose.model('UserKYC', userKYCSchema);
module.exports = { UserKYC };