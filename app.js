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

// Initialize Firebase Admin (required for file uploads)
const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

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
const verificationRoutes = require('./routes/verificationRoutes');
const userSessionRoutes = require('./routes/userSessionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const settingsRoutes = require('./routes/settingRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const fileUploadRoutes = require('./routes/uploadFileRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Security middlewares
app.use(helmet());
app.use(mongoSanitize());

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing and compression
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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
app.use('/api/verification', verificationRoutes);
app.use('/api/sessions', userSessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/files', fileUploadRoutes);
app.use('/api/webhooks', webhookRoutes);

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