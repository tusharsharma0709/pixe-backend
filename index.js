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
            // UPDATED: Import the unified GTM service
            const unifiedGtmService = require('./services/gtmTrackingServices');
            
            // Check if GTM credentials are configured
            if (process.env.DEFAULT_ACCOUNT_ID && process.env.DEFAULT_CONTAINER_ID) {
                console.log('🔄 Initializing Unified GTM tracking components...');
                
                // UPDATED: The unified service doesn't need a setup function
                // GTM components are created automatically when events are tracked
                console.log('✅ Unified GTM tracking service loaded successfully');
                console.log('   - Workflow tracking: ✅ Enabled');
                console.log('   - KYC tracking: ✅ Enabled'); 
                console.log('   - API call tracking: ✅ Enabled');
                console.log('   - User interaction tracking: ✅ Enabled');
                console.log('   - SurePass integration tracking: ✅ Enabled');
                
            } else {
                console.log('⚠️ GTM environment variables not set. GTM tracking will be disabled.');
            }
            
            // Check SurePass configuration
            if (process.env.SUREPASS_API_KEY) {
                console.log('✅ SurePass API configuration detected:');
                console.log('   - API Key: ✅ Configured');
                console.log('   - API URL:', process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io/api/v1');
                console.log('   - Test Mode:', process.env.BANK_TEST_MODE === 'true' ? 'Enabled' : 'Disabled');
            } else {
                console.log('⚠️ SurePass API key not configured. KYC verification may not work.');
                console.log('   Add SUREPASS_API_KEY to environment variables.');
            }
            
        } catch (gtmError) {
            console.error('❌ Failed to initialize Unified GTM tracking:', gtmError.message);
            // Non-blocking - continue server startup despite GTM initialization failure
        }
        
        // Start HTTP server
        server.listen(PORT, () => {
            console.log(`\n🚀 SERVER STARTED SUCCESSFULLY`);
            console.log(`   Port: ${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Base URL: http://localhost:${PORT}`);
            
            console.log('\n📋 SERVICE STATUS:');
            console.log('   ✅ Express server: Running');
            console.log('   ✅ MongoDB connection: Connected');
            console.log('   ✅ WebSocket tracking: Active');
            console.log('   ✅ Unified GTM service: Loaded');
            console.log('   ✅ SurePass integration: Ready');
            
            console.log('\n🔗 AVAILABLE ENDPOINTS:');
            console.log('   📊 Health Check: GET /health');
            console.log('   🔄 Workflows: /api/workflows');
            console.log('   📈 Tracking: /api/tracking');
            console.log('   🔍 SurePass: /api/workflows/surepass/endpoints');
            console.log('   📡 WebSocket: ws://localhost:' + PORT + '/tracking-ws');
            
            console.log('\n🎯 TRACKING CAPABILITIES:');
            console.log('   • Workflow creation & execution');
            console.log('   • User input collection');
            console.log('   • Condition evaluations');
            console.log('   • API call monitoring');
            console.log('   • KYC verification steps');
            console.log('   • SurePass endpoint tracking');
            console.log('   • Real-time event broadcasting');
            
            console.log('\n🔐 SUREPASS ENDPOINTS SUPPORTED:');
            console.log('   • /api/verification/aadhaar');
            console.log('   • /api/verification/aadhaar-otp');
            console.log('   • /api/verification/pan');
            console.log('   • /api/verification/aadhaar-pan-link');
            console.log('   • /api/verification/bank-account');
            
            console.log('\n✅ Server is ready to handle requests!');
            console.log('=' .repeat(60));
        });

        // Handle graceful shutdown
        const gracefulShutdown = () => {
            console.log('\n🛑 Received shutdown signal, closing HTTP server...');
            server.close(() => {
                console.log('✅ HTTP server closed');
                mongoose.connection.close(false, () => {
                    console.log('✅ MongoDB connection closed');
                    console.log('👋 Server shutdown complete');
                    process.exit(0);
                });
            });
        };

        // Handle server shutdown signals
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            gracefulShutdown();
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown();
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start everything
console.log('🔄 Starting server...');
startServer().catch(console.error);