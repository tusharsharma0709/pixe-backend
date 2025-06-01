// models/userTokens.js - Final fix for expiresAt duplicate index

const mongoose = require('mongoose');

const userTokenSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Users", 
        required: true 
    },
    token: { 
        type: String, 
        required: true 
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
        // COMPLETELY REMOVED: index: true - will ONLY be defined in schema.index() below
    }
}, { 
    timestamps: true 
});

// FIXED: Define TTL index here ONLY - removed from field definition completely
userTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic deletion
userTokenSchema.index({ userId: 1 }); // For faster user token lookups
userTokenSchema.index({ token: 1 }); // For token validation

const UserToken = mongoose.model("userTokens", userTokenSchema);
module.exports = { UserToken };