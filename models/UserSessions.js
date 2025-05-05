// models/UserSession.js
const mongoose = require('mongoose');
const userSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    },
    phone: {
        type: String,
        required: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns'
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        required: true
    },
    currentNodeId: {
        type: String
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'abandoned'],
        default: 'active'
    },
    stepsCompleted: [String]
  }, { timestamps: true });
  
  const UserSession = mongoose.model('UserSessions', userSessionSchema);
  module.exports = { UserSession };
  