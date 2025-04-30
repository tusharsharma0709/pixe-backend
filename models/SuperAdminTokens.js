const mongoose = require('mongoose');

const superAdminTokenSchema = new mongoose.Schema({
    superAdminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SuperAdmins", 
        required: true 
    },
    token: { 
        type: String, 
        required: true 
    },
    tokenType: {
        type: String,
        enum: ["login"],
        default: "login"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const SuperAdminTokens = mongoose.model("superAdminTokens", superAdminTokenSchema);
module.exports = { SuperAdminTokens };
