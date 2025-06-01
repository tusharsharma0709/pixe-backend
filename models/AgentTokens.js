// models/AgentTokens.js
const mongoose = require('mongoose');

const agentTokenSchema = new mongoose.Schema({
    agentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Agents", 
        required: true 
    },
    token: { 
        type: String, 
        required: true 
    },
    tokenType: {
        type: String,
        enum: ["login", "reset_password", "app_auth"],
        default: "login"
    },
    deviceInfo: {
        type: Object,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
        // REMOVED: index: true - TTL index will be defined in schema.index() below
    },
    isRevoked: {
        type: Boolean,
        default: false
    },
    revokedAt: {
        type: Date,
        default: null
    },
    revokedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admins",
        default: null
    }
}, { 
    timestamps: true 
});

// Add indexes for faster queries
agentTokenSchema.index({ agentId: 1, tokenType: 1 });
agentTokenSchema.index({ token: 1 });
agentTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const AgentToken = mongoose.model("agentTokens", agentTokenSchema);
module.exports = { AgentToken };