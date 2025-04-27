const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String
    },
    email_id: {
        type: String
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Products", 
      required: true 
    },
    phone: { 
        type: String, 
        unique: true,
        required: true 
    },
    otp: { 
        type: String, 
        default: null 
    },
    otpExpiresAt: { 
        type: Date, 
        default: null 
    }, 
    isOtpVerified: { 
        type: Boolean,
        required: true, 
        default: false 
    },
    isPanVerified: {
        type: Boolean,
        required: true,
        default: false
    },
    isAadhaarVerified: {
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true });

const User = mongoose.model('Users', userSchema);
module.exports = { User };
