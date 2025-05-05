  // models/PanVerification.js
  const mongoose = require('mongoose');
  const panVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        unique: true
    },
    panNumber: {
        type: String
    },
    panData: {
        type: String // JSON string of PAN OCR data
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    nameOnPan: {
        type: String
    },
    verificationDate: {
        type: Date
    }
  }, { timestamps: true });
  
  const PanVerification = mongoose.model('PanVerification', panVerificationSchema);
  module.exports = { PanVerification };
  