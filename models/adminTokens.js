// models/adminTokens.js
const mongoose = require('mongoose');

const adminTokenSchema = new mongoose.Schema({
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Admins", 
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

const AdminTokens = mongoose.model("adminTokens", adminTokenSchema);
module.exports = { AdminTokens };
