const mongoose = require('mongoose');
  // models/AadhaarVerification.js
  const aadhaarVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        unique: true
    },
    aadhaarNumber: {
        type: String
    },
    aadhaarData: {
        type: String // JSON string of Aadhaar OCR data
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    ocrVerified: {
        type: Boolean,
        default: false
    },
    otpVerified: {
        type: Boolean,
        default: false
    },
    aadhaarClientId: {
        type: String // For Aadhaar OTP verification
    },
    validationData: {
        type: String // JSON string of Aadhaar validation response
    },
    verificationDate: {
        type: Date
    }
  }, { timestamps: true });
  
  const AadhaarVerification = mongoose.model('AadhaarVerification', aadhaarVerificationSchema);
  module.exports = { AadhaarVerification };
  