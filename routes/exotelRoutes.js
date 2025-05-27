// routes/exotelRoutes.js - Complete Exotel routes

const express = require('express');
const router = express.Router();
const ExotelController = require('../controllers/exotelControllers');
const { adminOrAgentAuth } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validationMiddleware');
const { body, param, query } = require('express-validator');

// Validation schemas
const makeCallValidation = [
    body('from')
        .notEmpty()
        .withMessage('From number is required')
        .isMobilePhone()
        .withMessage('Invalid from number format'),
    body('to')
        .notEmpty()
        .withMessage('To number is required')
        .isMobilePhone()
        .withMessage('Invalid to number format'),
    body('callerId')
        .notEmpty()
        .withMessage('Caller ID is required')
        .isMobilePhone()
        .withMessage('Invalid caller ID format'),
    body('record')
        .optional()
        .isBoolean()
        .withMessage('Record must be a boolean'),
    body('timeLimit')
        .optional()
        .isInt({ min: 1, max: 14400 })
        .withMessage('Time limit must be between 1 and 14400 seconds'),
    body('customField1')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Custom field 1 must be less than 100 characters'),
    body('customField2')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Custom field 2 must be less than 100 characters')
];

const callSidValidation = [
    param('callSid')
        .notEmpty()
        .withMessage('Call SID is required')
        .isLength({ min: 10 })
        .withMessage('Invalid Call SID format')
];

const dtmfValidation = [
    body('digits')
        .notEmpty()
        .withMessage('Digits are required')
        .matches(/^[0-9#*]+$/)
        .withMessage('Digits can only contain 0-9, #, and *')
        .isLength({ min: 1, max: 20 })
        .withMessage('Digits must be between 1 and 20 characters')
];

const callsQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
        .optional()
        .isIn(['createdAt', 'status', 'duration', 'fromNumber', 'toNumber'])
        .withMessage('Invalid sort field'),
    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc'),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
];

// =======================
// AUTHENTICATED ROUTES (Admin required)
// =======================

/**
 * @route   POST /api/exotel/calls
 * @desc    Make an outbound call
 * @access  Private (Admin)
 * @body    { from, to, callerId, record?, timeLimit?, customField1?, customField2? }
 */
router.post('/calls', 
    adminOrAgentAuth, 
    makeCallValidation, 
    validateRequest, 
    ExotelController.makeCall
);

/**
 * @route   GET /api/exotel/calls
 * @desc    Get list of calls with filters and pagination
 * @access  Private (Admin)
 * @query   { from?, to?, status?, startDate?, endDate?, direction?, page?, limit?, sortBy?, sortOrder? }
 */
router.get('/calls', 
    adminOrAgentAuth, 
    callsQueryValidation, 
    validateRequest, 
    ExotelController.getCalls
);

/**
 * @route   GET /api/exotel/calls/:callSid
 * @desc    Get specific call details
 * @access  Private (Admin)
 * @params  { callSid }
 */
router.get('/calls/:callSid', 
    adminOrAgentAuth, 
    callSidValidation, 
    validateRequest, 
    ExotelController.getCallDetails
);

/**
 * @route   GET /api/exotel/calls/:callSid/recording
 * @desc    Get call recording details or download recording
 * @access  Private (Admin)
 * @params  { callSid }
 * @query   { download? } - Set to 'true' to download the actual recording file
 */
router.get('/calls/:callSid/recording', 
    adminOrAgentAuth, 
    callSidValidation, 
    validateRequest, 
    ExotelController.getCallRecording
);

/**
 * @route   POST /api/exotel/calls/:callSid/hangup
 * @desc    Hangup an active call
 * @access  Private (Admin)
 * @params  { callSid }
 */
router.post('/calls/:callSid/hangup', 
    adminOrAgentAuth, 
    callSidValidation, 
    validateRequest, 
    ExotelController.hangupCall
);

/**
 * @route   POST /api/exotel/calls/:callSid/dtmf
 * @desc    Send DTMF digits to an active call
 * @access  Private (Admin)
 * @params  { callSid }
 * @body    { digits }
 */
router.post('/calls/:callSid/dtmf', 
    adminOrAgentAuth, 
    callSidValidation, 
    dtmfValidation, 
    validateRequest, 
    ExotelController.sendDtmf
);

/**
 * @route   GET /api/exotel/account
 * @desc    Get Exotel account information and balance
 * @access  Private (Admin)
 */
router.get('/account', 
    adminOrAgentAuth, 
    ExotelController.getAccountInfo
);

/**
 * @route   GET /api/exotel/phone-numbers
 * @desc    Get list of purchased phone numbers
 * @access  Private (Admin)
 */
router.get('/phone-numbers', 
    adminOrAgentAuth, 
    ExotelController.getPhoneNumbers
);

/**
 * @route   GET /api/exotel/analytics
 * @desc    Get call analytics and statistics
 * @access  Private (Admin)
 * @query   { startDate?, endDate?, groupBy? }
 */
router.get('/analytics', 
    adminOrAgentAuth, 
    [
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format'),
        query('groupBy')
            .optional()
            .isIn(['hour', 'day', 'month'])
            .withMessage('Group by must be hour, day, or month')
    ],
    validateRequest, 
    ExotelController.getCallAnalytics
);

// =======================
// WEBHOOK ROUTES (No authentication - Exotel callbacks)
// =======================

/**
 * @route   POST /api/exotel/webhook/call-status
 * @desc    Webhook for call status updates from Exotel
 * @access  Public (Exotel webhook)
 * @body    Exotel webhook payload
 */
router.post('/webhook/call-status', ExotelController.handleCallStatusWebhook);

/**
 * @route   POST /api/exotel/webhook/voice
 * @desc    Webhook for incoming voice calls (returns TwiML)
 * @access  Public (Exotel webhook)
 * @body    Exotel webhook payload
 */
router.post('/webhook/voice', ExotelController.handleVoiceWebhook);

/**
 * @route   GET /api/exotel/webhook/voice
 * @desc    Webhook for incoming voice calls (GET method support)
 * @access  Public (Exotel webhook)
 */
router.get('/webhook/voice', ExotelController.handleVoiceWebhook);

// =======================
// UTILITY ROUTES
// =======================

/**
 * @route   GET /api/exotel/health
 * @desc    Check Exotel service health and configuration
 * @access  Private (Admin)
 */
router.get('/health', adminOrAgentAuth, (req, res) => {
    const exotelService = require('../services/exotelServices');
    
    const healthCheck = {
        configured: exotelService.isConfigured(),
        environment: {
            hasAccountSid: !!process.env.EXOTEL_ACCOUNT_SID,
            hasApiKey: !!process.env.EXOTEL_API_KEY,
            hasApiToken: !!process.env.EXOTEL_API_TOKEN,
            subdomain: process.env.EXOTEL_SUBDOMAIN || 'api'
        },
        baseUrl: exotelService.baseUrl,
        timestamp: new Date().toISOString()
    };

    return res.status(200).json({
        success: true,
        message: healthCheck.configured ? "Exotel service is properly configured" : "Exotel service configuration incomplete",
        data: healthCheck
    });
});

/**
 * @route   POST /api/exotel/test-connection
 * @desc    Test connection to Exotel API
 * @access  Private (Admin)
 */
router.post('/test-connection', adminOrAgentAuth, async (req, res) => {
    try {
        const exotelService = require('../services/exotelServices');
        
        if (!exotelService.isConfigured()) {
            return res.status(400).json({
                success: false,
                message: "Exotel service not configured"
            });
        }

        // Test by getting account info
        const result = await exotelService.getAccountInfo();
        
        return res.status(200).json({
            success: result.success,
            message: result.success ? "Connection successful" : "Connection failed",
            data: result.success ? {
                balance: result.balance,
                status: result.status
            } : {
                error: result.error
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Connection test failed",
            error: error.message
        });
    }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
    console.error('Exotel Routes Error:', error);
    
    return res.status(500).json({
        success: false,
        message: "Internal server error in Exotel routes",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

module.exports = router;