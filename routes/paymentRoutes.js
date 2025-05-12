// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentControllers');
const { userAuth, adminAuth } = require('../middlewares/auth');

// User Routes
router.post('/initialize', userAuth, PaymentController.initializeFacebookPayment);
router.get('/:paymentId', userAuth, PaymentController.getPaymentDetails);

// Admin Routes
router.get('/admin/history', adminAuth, PaymentController.getAdminPaymentHistory);
router.post('/admin/:paymentId/refund', adminAuth, PaymentController.processRefund);
router.get('/admin/analytics', adminAuth, PaymentController.getPaymentAnalytics);

// Webhook Route (Public - but should be secured with webhook signature verification)
router.post('/webhook', PaymentController.handlePaymentWebhook);

module.exports = router;