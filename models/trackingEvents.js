// models/TrackingEvents.js
const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema({
    event: {
        type: String,
        required: true,
        index: true
    },
    workflow_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        index: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        index: true
    },
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        index: true
    },
    workflow_node_id: String,
    step: String,
    success: Boolean,
    completion_percentage: Number,
    timestamp: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    data: mongoose.Schema.Types.Mixed
}, { 
    timestamps: true 
});

// Create TTL index to automatically delete old tracking events after 90 days
trackingEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const TrackingEvent = mongoose.models.TrackingEvents || 
                      mongoose.model('TrackingEvents', trackingEventSchema);

module.exports = { TrackingEvent };