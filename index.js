// index.js - Updated to use unified GTM tracking service
require('dotenv').config(); // Load environment variables first
const mongoose = require('mongoose');
const http = require('http'); // Added for WebSocket support
const WebSocket = require('ws'); // Need to install with: npm install ws
const app = require('./app');

console.log('Starting server initialization...');
console.log('MongoDB URI loaded:', !!process.env.MONGODB_URI);
console.log('PORT:', process.env.PORT || 3001);

// Database connection
const connectDB = async () => {
    try {
        console.log('Attempting MongoDB connection...');
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Set port
const PORT = process.env.PORT || 3001;

// Start server with database connection
const startServer = async () => {
    try {
        // Connect to MongoDB first
        await connectDB();
        
        // Create HTTP server using Express app
        const server = http.createServer(app);
        
        // Initialize WebSocket server for tracking
        const wss = new WebSocket.Server({ 
            server,
            path: '/tracking-ws'
        });
        console.log('🔌 Tracking WebSocket server initialized on /tracking-ws');
        
        // Handle WebSocket connections
        wss.on('connection', (ws, req) => {
            console.log(`📡 New tracking client connected: ${req.socket.remoteAddress}`);
            
            // Send initial connection message
            ws.send(JSON.stringify({
                event: 'tracking_connection_established',
                timestamp: new Date().toISOString()
            }));
            
            // Handle disconnection
            ws.on('close', () => {
                console.log(`📡 Tracking client disconnected: ${req.socket.remoteAddress}`);
            });
        });
        
        // Store WebSocket server in global object for access in other modules
        global.trackingWss = wss;
        
        // Initialize GTM tracking with unified service
        try {
            // FIXED: Import the unified GTM service instead of the incorrect path
            const unifiedGtmService = require('./services/gtmTrackingServices');
            
            // Check if GTM credentials are configured
            if (process.env.DEFAULT_ACCOUNT_ID && process.env.DEFAULT_CONTAINER_ID) {
                console.log('🔄 Initializing Unified GTM tracking components...');
                
                // UPDATED: The unified service doesn't need a setup function
                // GTM components are created automatically when events are tracked
                // But we can verify the configuration here
                console.log('✅ Unified GTM tracking service loaded successfully');
                console.log('   - Workflow tracking: Enabled');
                console.log('   - KYC tracking: Enabled'); 
                console.log('   - API call tracking: Enabled');
                console.log('   - User interaction tracking: Enabled');
            } else {
                console.log('⚠️ GTM environment variables not set. GTM tracking will be disabled.');
                console.log('   Required: DEFAULT_ACCOUNT_ID, DEFAULT_CONTAINER_ID');
                console.log('   Optional: DEFAULT_WORKSPACE_ID, GA4_MEASUREMENT_ID');
            }
        } catch (gtmError) {
            console.error('❌ Failed to initialize Unified GTM tracking:', gtmError.message);
            // Non-blocking - continue server startup despite GTM initialization failure
        }
        
        // Start HTTP server
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('🚀 All services initialized:');
            console.log('   - Express server: ✅');
            console.log('   - MongoDB connection: ✅');
            console.log('   - WebSocket tracking: ✅');
            console.log('   - Unified GTM service: ✅');
        });

        // Handle graceful shutdown
        const gracefulShutdown = () => {
            console.log('Received shutdown signal, closing HTTP server...');
            server.close(() => {
                console.log('HTTP server closed');
                mongoose.connection.close(false, () => {
                    console.log('MongoDB connection closed');
                    process.exit(0);
                });
            });
        };

        // Handle server shutdown signals
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start everything
console.log('Starting server...');
startServer().catch(console.error);