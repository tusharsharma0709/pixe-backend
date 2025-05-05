const mongoose = require('mongoose');
  // models/BankingVerification.js
  const bankingVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        unique: true
    },
    accountNumber: {
        type: String
    },
    ifscCode: {
        type: String
    },
    bankName: {
        type: String
    },
    accountHolderName: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationMethod: {
        type: String,
        enum: ['penny-drop', 'bank-statement', 'manual'],
        default: 'penny-drop'
    },
    verificationData: {
        type: String // JSON string of verification data
    },
    verificationDate: {
        type: Date
    }
  }, { timestamps: true });
  
  const BankingVerification = mongoose.model('BankingVerification', bankingVerificationSchema);
  module.exports = { BankingVerification };
