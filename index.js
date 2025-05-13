// index.js
require('dotenv').config(); // Load environment variables first
const mongoose = require('mongoose');
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
        
        // Then start the server
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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