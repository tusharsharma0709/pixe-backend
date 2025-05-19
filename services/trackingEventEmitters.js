// services/trackingEventEmitter.js
const EventEmitter = require('events');

class TrackingEventEmitter extends EventEmitter {}

// Create a singleton instance
const trackingEmitter = new TrackingEventEmitter();

/**
 * Broadcast tracking event to connected WebSocket clients
 * @param {Object} eventData - Event data to broadcast
 */
function broadcastTrackingEvent(eventData) {
    // Emit event locally
    trackingEmitter.emit('tracking_event', eventData);
    
    // Broadcast to WebSocket clients if WebSocket server exists
    if (global.trackingWss) {
        const wss = global.trackingWss;
        
        if (wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    try {
                        client.send(JSON.stringify(eventData));
                    } catch (err) {
                        console.error('Error sending tracking event to WebSocket client:', err);
                    }
                }
            });
        }
    }
}

module.exports = {
    trackingEmitter,
    broadcastTrackingEvent
};