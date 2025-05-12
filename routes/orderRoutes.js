// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderControllers');
const { adminAuth, agentAuth, userAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Create a new order
router.post('/', userAuth, OrderController.createOrder);

// Admin routes
// Get orders for admin
router.get('/admin', adminAuth, OrderController.getAdminOrders);

// Get order analytics
router.get('/admin/analytics', adminAuth, OrderController.getOrderAnalytics);

// Update order status
router.patch('/admin/:id/status', adminAuth, OrderController.updateOrderStatus);

// Update shipping information
router.patch('/admin/:id/shipping', adminAuth, OrderController.updateShipping);

// Generate invoice for order
router.post('/admin/:id/invoice', adminAuth, OrderController.generateInvoice);

// Update order notes
router.patch('/admin/:id/notes', adminAuth, OrderController.updateOrderNotes);

// Cancel order (admin)
router.post('/admin/:id/cancel', adminAuth, OrderController.cancelOrder);

// Agent routes
// Get orders for agent
router.get('/agent', agentAuth, OrderController.getAgentOrders);

// Update order status (agent)
router.patch('/agent/:id/status', agentAuth, OrderController.updateOrderStatus);

// Update order notes (agent)
router.patch('/agent/:id/notes', agentAuth, OrderController.updateOrderNotes);

// User routes
// Get user's orders
router.get('/user', userAuth, OrderController.getUserOrders);

// Cancel order (user)
router.post('/user/:id/cancel', userAuth, OrderController.cancelOrder);

// Common routes (require authentication)
// Get order by ID - available to admin, agent, and user with proper permissions
router.get('/:id', (req, res, next) => {
    // Try all authentication methods
    userAuth(req, res, (err) => {
        if (err) {
            adminAuth(req, res, (err) => {
                if (err) {
                    agentAuth(req, res, next);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    });
}, OrderController.getOrder);

module.exports = router;