// app.js (fixed version - remove server startup code)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const path = require('path');

const app = express();
// Set up static file serving
app.use(express.static(path.join(__dirname, 'public')));
// Add this to app.js before routes to modify URL parsing
app.set('query parser', (queryString) => {
    console.log('Raw query string:', queryString);
    const result = new URLSearchParams(queryString);
    const params = {};
    for (const [key, value] of result) {
      params[key] = value;
    }
    console.log('Custom parsed params:', params);
    return params;
  });
app.set('trust proxy', 1);
// Add a basic route for the homepage
app.get('/', (req, res) => {
    res.send('WhatsApp API Server is running');
});

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const userRoutes = require('./routes/userRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const whatsappTemplateRoutes = require('./routes/whatsappTemplateRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const campaignWorkflowRoutes = require('./routes/campaignRequestRoutes');
const productRequestRoutes = require('./routes/productRequestRoutes');
const productCatalogRoutes = require('./routes/productCatalogRoutes');
const leadAssignmentRoutes = require('./routes/leadAssignmentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
// const verificationRoutes = require('./routes/verificationRoutes');
const userSessionRoutes = require('./routes/userSessionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const settingsRoutes = require('./routes/settingRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const fileUploadRoutes = require('./routes/uploadFileRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const messageRoutes = require('./routes/messageRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const gtmRoutes = require('./routes/gtmRoutes');
const exotelRoutes = require('./routes/exotelRoutes');
const makeRoutes = require('./routes/makeRoutes');


// Security middlewares
app.use(helmet());
app.use(mongoSanitize());

// Replace your current CORS configuration with this
const corsOptions = {
    origin: function (origin, callback) {
        // For development, allow all origins or add your frontend URL
        // For production, use the ALLOWED_ORIGINS list
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:5173','http://localhost:5174', 'http://127.0.0.1:5174'];
        
        // During development or for testing, sometimes origin is undefined (like Postman requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`CORS blocked request from origin: ${origin}`);
            console.log(`Allowed origins:`, allowedOrigins);
            callback(null, true); // For debugging, temporarily allow all (remove in production)
            // callback(new Error('Not allowed by CORS')); // Enable this in production
        }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Also add OPTIONS preflight handling before any routes
app.options('*', cors(corsOptions));

// Body parsing and compression
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 25 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// Specific rate limiters for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/admin/login', authLimiter);
app.use('/api/admin/register', authLimiter);
app.use('/api/agent/login', authLimiter);
app.use('/api/user/auth', authLimiter);
app.use('/api/user/verify-otp', authLimiter);
app.use('/api/superadmin/login', authLimiter);

// WhatsApp webhook rate limiter (higher limit)
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // higher limit for webhooks
    message: 'Too many webhook requests'
});

app.use('/api/whatsapp/webhook', webhookLimiter);
// Add this near your routes in app.js
const multer = require('./middlewares/multer');

// Apply this after your routes but before the 404 handler
app.use(multer.handleMulterError);

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/whatsapp-templates', whatsappTemplateRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/campaigns', campaignWorkflowRoutes);
app.use('/api/products', productRequestRoutes);
app.use('/api/product-catalogs', productCatalogRoutes);
app.use('/api/leads', leadAssignmentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/verification', verificationRoutes);
app.use('/api/sessions', userSessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/files', fileUploadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/gtm', gtmRoutes);
app.use('/api/exotel', exotelRoutes);
app.use('/api/make', makeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // MongoDB duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

module.exports = app;