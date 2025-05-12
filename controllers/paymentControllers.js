// controllers/PaymentController.js
const { Payment } = require('../models/Payments');
const { Order } = require('../models/Orders');
const { User } = require('../models/Users');
const { Product } = require('../models/Products');
const { Admin } = require('../models/Admins');
const { Invoice } = require('../models/Invoices');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const axios = require('axios');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Helper function to log activity
const logActivity = async (data) => {
    try {
        const activityLog = new ActivityLog(data);
        await activityLog.save();
        return activityLog;
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

// Helper function to create notification
const createNotification = async (data) => {
    try {
        const notification = new Notification(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};

const PaymentController = {
    // Initialize Facebook payment
    initializeFacebookPayment: async (req, res) => {
        try {
            const { orderId, userId } = req.body;

            // Validate order exists
            const order = await Order.findById(orderId)
                .populate('products.productId');

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check if order belongs to user
            if (order.userId.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to order"
                });
            }

            // Check if payment already exists
            const existingPayment = await Payment.findOne({
                orderId: order._id,
                status: { $in: ['pending', 'processing', 'completed'] }
            });

            if (existingPayment) {
                return res.status(400).json({
                    success: false,
                    message: "Payment already exists for this order",
                    data: existingPayment
                });
            }

            // Generate unique payment ID
            const paymentId = `PAY${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

            // Create payment record
            const payment = new Payment({
                paymentId,
                userId: order.userId,
                adminId: order.adminId,
                orderId: order._id,
                sessionId: order.sessionId,
                amount: order.totalAmount + order.taxAmount - order.discountAmount + order.shippingAmount,
                currency: order.currency,
                paymentMethod: order.payment.method,
                status: 'pending',
                paymentSource: 'whatsapp',
                paymentProvider: 'facebook',
                paymentDate: new Date(),
                metadata: {
                    orderNumber: order.orderNumber,
                    productCount: order.products.length
                }
            });

            await payment.save();

            // Update order payment info
            order.payment.status = 'pending';
            order.payment.transactionId = payment._id;
            await order.save();

            // Create Facebook payment request
            const fbPaymentRequest = await createFacebookPaymentRequest(order, payment);

            if (fbPaymentRequest.success) {
                payment.gatewayResponse = fbPaymentRequest.data;
                payment.transactionId = fbPaymentRequest.data.payment_id;
                await payment.save();

                // Log activity
                await logActivity({
                    actorId: userId,
                    actorModel: 'Users',
                    actorName: order.userId.name || order.userId.phone,
                    action: 'payment_created',
                    entityType: 'Payment',
                    entityId: payment._id,
                    description: `Payment initiated for order ${order.orderNumber}`,
                    adminId: order.adminId
                });

                return res.status(201).json({
                    success: true,
                    message: "Payment initialized successfully",
                    data: {
                        paymentId: payment.paymentId,
                        paymentUrl: fbPaymentRequest.data.payment_url,
                        amount: payment.amount,
                        currency: payment.currency
                    }
                });
            } else {
                payment.status = 'failed';
                payment.errorMessage = fbPaymentRequest.error;
                await payment.save();

                return res.status(400).json({
                    success: false,
                    message: "Failed to initialize payment",
                    error: fbPaymentRequest.error
                });
            }
        } catch (error) {
            console.error("Error in initializeFacebookPayment:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Handle Facebook payment webhook
    handlePaymentWebhook: async (req, res) => {
        try {
            const { payment_id, status, transaction_id, error_code, error_message } = req.body;

            // Find payment by Facebook payment ID
            const payment = await Payment.findOne({ transactionId: payment_id });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            // Update payment status based on webhook
            if (status === 'completed' || status === 'success') {
                payment.status = 'completed';
                payment.settledAt = new Date();
                payment.gatewayResponse = req.body;

                // Update order status
                const order = await Order.findById(payment.orderId);
                if (order) {
                    order.payment.status = 'completed';
                    order.payment.transactionId = transaction_id;
                    order.payment.paymentDate = new Date();
                    order.status = 'processing';
                    
                    order.statusHistory.push({
                        status: 'processing',
                        timestamp: new Date(),
                        updatedBy: {
                            id: payment.userId,
                            role: 'user'
                        },
                        notes: 'Payment completed successfully'
                    });

                    await order.save();

                    // Generate invoice
                    const invoice = await generateInvoice(order, payment);
                }

                // Create notification for admin
                await createNotification({
                    title: "Payment Received",
                    description: `Payment of ${payment.amount} ${payment.currency} received for order ${order.orderNumber}`,
                    type: 'payment',
                    priority: 'high',
                    forAdmin: payment.adminId,
                    relatedTo: {
                        model: 'Payment',
                        id: payment._id
                    }
                });

            } else if (status === 'failed' || status === 'cancelled') {
                payment.status = 'failed';
                payment.errorCode = error_code;
                payment.errorMessage = error_message;
                payment.gatewayResponse = req.body;

                // Update order status
                const order = await Order.findById(payment.orderId);
                if (order) {
                    order.payment.status = 'failed';
                    order.status = 'pending';
                    await order.save();
                }
            }

            await payment.save();

            // Log activity
            await logActivity({
                actorId: payment.userId,
                actorModel: 'Users',
                action: status === 'completed' ? 'payment_succeeded' : 'payment_failed',
                entityType: 'Payment',
                entityId: payment._id,
                description: `Payment ${status} for amount ${payment.amount} ${payment.currency}`,
                adminId: payment.adminId,
                status: status === 'completed' ? 'success' : 'failure'
            });

            return res.status(200).json({
                success: true,
                message: `Payment ${status}`
            });
        } catch (error) {
            console.error("Error in handlePaymentWebhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get payment details
    getPaymentDetails: async (req, res) => {
        try {
            const { paymentId } = req.params;
            const userId = req.userId;

            const payment = await Payment.findOne({ paymentId })
                .populate('orderId', 'orderNumber products totalAmount')
                .populate('userId', 'name phone email_id');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            // Check if user has permission to view this payment
            if (payment.userId._id.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to payment"
                });
            }

            return res.status(200).json({
                success: true,
                data: payment
            });
        } catch (error) {
            console.error("Error in getPaymentDetails:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get payment history for admin
    getAdminPaymentHistory: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                startDate,
                endDate,
                paymentMethod,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (paymentMethod) query.paymentMethod = paymentMethod;

            // Add date filters
            if (startDate || endDate) {
                query.paymentDate = {};
                if (startDate) query.paymentDate.$gte = new Date(startDate);
                if (endDate) query.paymentDate.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                query.$or = [
                    { paymentId: { $regex: search, $options: 'i' } },
                    { transactionId: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.paymentDate = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Payment.countDocuments(query);

            // Execute query with pagination
            const payments = await Payment.find(query)
                .populate('userId', 'name phone email_id')
                .populate('orderId', 'orderNumber')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Calculate total amounts
            const totalStats = await Payment.aggregate([
                { $match: { ...query, status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$amount" },
                        totalTransactions: { $sum: 1 },
                        avgTransaction: { $avg: "$amount" }
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                data: payments,
                stats: totalStats[0] || {
                    totalAmount: 0,
                    totalTransactions: 0,
                    avgTransaction: 0
                },
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminPaymentHistory:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Process refund
    processRefund: async (req, res) => {
        try {
            const { paymentId } = req.params;
            const { amount, reason } = req.body;
            const adminId = req.adminId;

            const payment = await Payment.findOne({ paymentId });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            // Check if payment belongs to admin
            if (payment.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to payment"
                });
            }

            // Check if payment is completed
            if (payment.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    message: "Can only refund completed payments"
                });
            }

            // Validate refund amount
            const totalRefunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
            if (amount > (payment.amount - totalRefunded)) {
                return res.status(400).json({
                    success: false,
                    message: "Refund amount exceeds available balance"
                });
            }

            // Generate refund ID
            const refundId = `REF${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

            // Process refund via Facebook API
            const fbRefundResult = await processFacebookRefund(payment, amount, reason);

            if (fbRefundResult.success) {
                // Add refund to payment record
                payment.refunds.push({
                    refundId,
                    amount,
                    reason,
                    status: 'completed',
                    initiatedBy: {
                        id: adminId,
                        role: 'admin'
                    },
                    refundedAt: new Date(),
                    gatewayResponse: fbRefundResult.data
                });

                // Update payment status
                if (amount === (payment.amount - totalRefunded)) {
                    payment.status = 'refunded';
                } else {
                    payment.status = 'partially_refunded';
                }

                await payment.save();

                // Update order status
                const order = await Order.findById(payment.orderId);
                if (order) {
                    order.status = 'refunded';
                    order.payment.status = 'refunded';
                    await order.save();
                }

                // Get admin details for logging
                const admin = await Admin.findById(adminId);

                // Log activity
                await logActivity({
                    actorId: adminId,
                    actorModel: 'Admins',
                    actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                    action: 'payment_refunded',
                    entityType: 'Payment',
                    entityId: payment._id,
                    description: `Refund of ${amount} ${payment.currency} processed`,
                    adminId
                });

                // Create notification for user
                await createNotification({
                    title: "Refund Processed",
                    description: `Refund of ${amount} ${payment.currency} has been processed for your order`,
                    type: 'payment',
                    priority: 'high',
                    forUser: payment.userId,
                    relatedTo: {
                        model: 'Payment',
                        id: payment._id
                    }
                });

                return res.status(200).json({
                    success: true,
                    message: "Refund processed successfully",
                    data: {
                        refundId,
                        amount,
                        status: 'completed'
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Failed to process refund",
                    error: fbRefundResult.error
                });
            }
        } catch (error) {
            console.error("Error in processRefund:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get payment analytics
    getPaymentAnalytics: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.paymentDate = {};
                if (startDate) dateFilter.paymentDate.$gte = new Date(startDate);
                if (endDate) dateFilter.paymentDate.$lte = new Date(endDate);
            }

            // Base query
            const baseQuery = { adminId, ...dateFilter };

            // Get payment statistics
            const paymentStats = await Payment.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: null,
                        totalPayments: { $sum: 1 },
                        totalAmount: { $sum: "$amount" },
                        avgAmount: { $avg: "$amount" },
                        successfulPayments: {
                            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                        },
                        failedPayments: {
                            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                        },
                        refundedAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "refunded"] },
                                    "$amount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            // Get payment method distribution
            const paymentMethodStats = await Payment.aggregate([
                { $match: { ...baseQuery, status: 'completed' } },
                {
                    $group: {
                        _id: "$paymentMethod",
                        count: { $sum: 1 },
                        amount: { $sum: "$amount" }
                    }
                }
            ]);

            // Get daily payment trends
            const dailyTrends = await Payment.aggregate([
                { $match: { ...baseQuery, status: 'completed' } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$paymentDate" },
                            month: { $month: "$paymentDate" },
                            day: { $dayOfMonth: "$paymentDate" }
                        },
                        count: { $sum: 1 },
                        amount: { $sum: "$amount" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]);

            // Format daily trends
            const formattedDailyTrends = dailyTrends.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                count: item.count,
                amount: item.amount
            }));

            // Calculate success rate
            const successRate = paymentStats[0] && paymentStats[0].totalPayments > 0
                ? (paymentStats[0].successfulPayments / paymentStats[0].totalPayments) * 100
                : 0;

            return res.status(200).json({
                success: true,
                data: {
                    overview: {
                        totalPayments: paymentStats[0]?.totalPayments || 0,
                        totalAmount: paymentStats[0]?.totalAmount || 0,
                        avgAmount: paymentStats[0]?.avgAmount || 0,
                        successRate: parseFloat(successRate.toFixed(2)),
                        refundedAmount: paymentStats[0]?.refundedAmount || 0
                    },
                    paymentMethods: paymentMethodStats,
                    dailyTrends: formattedDailyTrends
                }
            });
        } catch (error) {
            console.error("Error in getPaymentAnalytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

// Helper function to create Facebook payment request
async function createFacebookPaymentRequest(order, payment) {
    try {
        const fbApiUrl = process.env.FACEBOOK_PAYMENT_API_URL;
        const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

        const payload = {
            order_id: order._id,
            amount: payment.amount,
            currency: payment.currency,
            description: `Payment for order ${order.orderNumber}`,
            return_url: `${process.env.APP_URL}/payment/success`,
            cancel_url: `${process.env.APP_URL}/payment/cancel`,
            notify_url: `${process.env.APP_URL}/api/payment/webhook`
        };

        const response = await axios.post(fbApiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, data: response.data };
    } catch (error) {
        console.error("Error creating Facebook payment:", error);
        return { success: false, error: error.message };
    }
}

// Helper function to process Facebook refund
async function processFacebookRefund(payment, amount, reason) {
    try {
        const fbApiUrl = `${process.env.FACEBOOK_PAYMENT_API_URL}/refunds`;
        const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

        const payload = {
            payment_id: payment.transactionId,
            amount,
            currency: payment.currency,
            reason
        };

        const response = await axios.post(fbApiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, data: response.data };
    } catch (error) {
        console.error("Error processing Facebook refund:", error);
        return { success: false, error: error.message };
    }
}

// Helper function to generate invoice
async function generateInvoice(order, payment) {
    try {
        const invoiceNumber = await Invoice.generateInvoiceNumber(order.adminId);
        
        const invoice = new Invoice({
            invoiceNumber,
            orderId: order._id,
            userId: order.userId,
            adminId: order.adminId,
            customerInfo: {
                name: order.userId.name || 'Customer',
                phone: order.userId.phone,
                email: order.userId.email_id
            },
            items: order.products.map(product => ({
                name: product.name,
                quantity: product.quantity,
                unitPrice: product.price,
                totalPrice: product.subtotal,
                taxRate: product.tax.rate,
                taxAmount: product.tax.amount
            })),
            subtotal: order.totalAmount,
            taxTotal: order.taxAmount,
            discountTotal: order.discountAmount,
            shippingTotal: order.shippingAmount,
            grandTotal: payment.amount,
            amountPaid: payment.amount,
            paymentStatus: 'paid',
            status: 'sent',
            invoiceDate: new Date(),
            paidAt: new Date()
        });

        await invoice.save();
        return invoice;
    } catch (error) {
        console.error("Error generating invoice:", error);
        throw error;
    }
}

module.exports = PaymentController;