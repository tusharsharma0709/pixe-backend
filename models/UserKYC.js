const mongoose = require('mongoose');

const userKYCSchema = new mongoose.Schema({
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Users", 
      required: true 
    },
    aadhaarData: { 
        type: String, 
        default: true 
    },
    panNumber: {
        type: String
    },
    aadhaarNumber: {
        type: Number
    },
    panData: { 
        type: String, 
        default: null 
    }
}, { timestamps: true });

const UserKYC = mongoose.model('User_KYC', userKYCSchema);
module.exports = { UserKYC };
