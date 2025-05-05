// models/Campaign.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    facebookCampaignId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed'],
        default: 'active'
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        required: true
    }
}, { timestamps: true });

const Campaign = mongoose.model('Campaigns', campaignSchema);
module.exports = { Campaign };