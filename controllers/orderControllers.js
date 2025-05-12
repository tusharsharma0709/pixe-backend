// controllers/OrderController.js
const { Order } = require('../models/Orders');
const { User } = require('../models/Users');
const { Admin } = require('../models/Admins');
const { Agent } = require('../models/Agents');
const { Product } = require('../models/Products');
const { Payment } = require('../models/Payments');
const { Campaign } = require('../models/Campaigns');
const { UserSession } = require('../models/UserSessions');
const { Invoice } = require('../models/Invoices');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
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

const OrderController = {
    // Create a new order
    createOrder: async (req, res) => {
        try {
            const {
                userId,
                sessionId,
                products,
                paymentMethod,
                shipping,
                notes,
                couponCode,
                metadata
            } = req.body;

            // Validate required fields
            if (!userId || !products || products.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and products are required"
                });
            }

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Get session info if provided
            let session = null;
            let adminId = user.adminId;
            let campaignId = null;
            let agentId = null;

            if (sessionId) {
                session = await UserSession.findById(sessionId);
                if (session) {
                    adminId = session.adminId;
                    campaignId = session.campaignId;
                    agentId = session.agentId;
                }
            }

            // Validate products and calculate totals
            const orderItems = [];
            let totalAmount = 0;
            let taxAmount = 0;
            let discountAmount = 0;
            let shippingAmount = 0;
            let isDigitalOnly = true;

            for (const item of products) {
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({
                        success: false,
                        message: `Product not found: ${item.productId}`
                    });
                }

                const itemPrice = item.price || product.price;
                const quantity = item.quantity || 1;
                const itemTotal = itemPrice * quantity;
                const itemTax = (item.tax?.rate || 0) * itemTotal / 100;
                const itemDiscount = item.discount || 0;

                orderItems.push({
                    productId: product._id,
                    name: product.name,
                    price: itemPrice,
                    quantity,
                    variant: item.variant,
                    tax: {
                        rate: item.tax?.rate || 0,
                        amount: itemTax
                    },
                    discount: itemDiscount,
                    subtotal: itemTotal
                });

                totalAmount += itemTotal;
                taxAmount += itemTax;
                discountAmount += itemDiscount;

                if (!product.isDigital) {
                    isDigitalOnly = false;
                }
            }

            // Handle shipping if not digital only
            if (!isDigitalOnly && shipping) {
                shippingAmount = shipping.cost || 0;
            }

            // Calculate grand total
            const grandTotal = totalAmount + taxAmount - discountAmount + shippingAmount;

            // Generate order number
            const orderNumber = await Order.generateOrderNumber();

            // Create order
            const order = new Order({
                orderNumber,
                userId,
                sessionId,
                adminId,
                campaignId,
                agentId,
                products: orderItems,
                totalAmount,
                taxAmount,
                discountAmount,
                shippingAmount,
                currency: 'INR',
                status: 'pending',
                payment: {
                    method: paymentMethod || 'facebook_pay',
                    status: 'pending',
                    amount: grandTotal
                },
                shipping: !isDigitalOnly ? shipping : null,
                isDigitalOnly,
                notes: notes ? {
                    customer: notes.customer,
                    admin: notes.admin,
                    internal: notes.internal
                } : null,
                metadata
            });

            // Add initial status history
            order.statusHistory.push({
                status: 'pending',
                timestamp: new Date(),
                updatedBy: {
                    id: adminId || userId,
                    role: adminId ? 'admin' : 'user'
                },
                notes: 'Order created'
            });

            await order.save();

            // Log activity
            await logActivity({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'order_created',
                entityType: 'Order',
                entityId: order._id,
                description: `Order created: ${orderNumber}`,
                adminId,
                status: 'success'
            });

            // Create notifications
            if (adminId) {
                await createNotification({
                    title: "New Order Received",
                    description: `New order ${orderNumber} for ${grandTotal} INR`,
                    type: 'order',
                    priority: 'high',
                    forAdmin: adminId,
                    relatedTo: {
                        model: 'Order',
                        id: order._id
                    },
                    actionUrl: `/orders/${order._id}`
                });
            }

            if (agentId) {
                await createNotification({
                    title: "New Order from Your Lead",
                    description: `Customer placed order ${orderNumber}`,
                    type: 'order',
                    priority: 'high',
                    forAgent: agentId,
                    relatedTo: {
                        model: 'Order',
                        id: order._id
                    },
                    actionUrl: `/orders/${order._id}`
                });
            }

            return res.status(201).json({
                success: true,
                message: "Order created successfully",
                data: order
            });
        } catch (error) {
            console.error("Error in createOrder:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get orders for admin
    getAdminOrders: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                status,
                paymentStatus,
                campaignId,
                agentId,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (paymentStatus) query['payment.status'] = paymentStatus;
            if (campaignId) query.campaignId = campaignId;
            if (agentId) query.agentId = agentId;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                query.$or = [
                    { orderNumber: { $regex: search, $options: 'i' } },
                    { 'notes.customer': { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Order.countDocuments(query);

            // Execute query with pagination
            const orders = await Order.find(query)
                .populate('userId', 'name phone email_id')
                .populate('agentId', 'first_name last_name')
                .populate('campaignId', 'name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: orders,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminOrders:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get orders for agent
    getAgentOrders: async (req, res) => {
        try {
            const agentId = req.agentId;
            const {
                status,
                paymentStatus,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
                page = 1,
                limit = 10
            } = req.query;

            // Build query - only orders from users assigned to this agent
            const query = { agentId };

            if (status) query.status = status;
            if (paymentStatus) query['payment.status'] = paymentStatus;

            // Add date filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Add search filter
            if (search) {
                query.$or = [
                    { orderNumber: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Order.countDocuments(query);

            // Execute query with pagination
            const orders = await Order.find(query)
                .populate('userId', 'name phone email_id')
                .populate('campaignId', 'name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: orders,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAgentOrders:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get order by ID
    getOrder: async (req, res) => {
        try {
            const { id } = req.params;
            const actorId = req.adminId || req.agentId || req.userId;
            const actorRole = req.adminId ? 'admin' : (req.agentId ? 'agent' : 'user');

            const order = await Order.findById(id)
                .populate('userId', 'name phone email_id')
                .populate('agentId', 'first_name last_name')
                .populate('campaignId', 'name')
                .populate('products.productId', 'name description');

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && order.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this order"
                });
            }

            if (actorRole === 'agent' && order.agentId && order.agentId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this order"
                });
            }

            if (actorRole === 'user' && order.userId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this order"
                });
            }

            // Get payment details if exists
            const payment = await Payment.findOne({ orderId: order._id });

            // Get invoice if exists
            const invoice = await Invoice.findOne({ orderId: order._id });

            return res.status(200).json({
                success: true,
                data: {
                    order,
                    payment,
                    invoice
                }
            });
        } catch (error) {
            console.error("Error in getOrder:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update order status
    updateOrderStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            const order = await Order.findById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && order.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this order"
                });
            }

            if (actorRole === 'agent' && order.agentId && order.agentId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this order"
                });
            }

            // Validate status transition
            const validStatusTransitions = {
                'pending': ['processing', 'cancelled'],
                'processing': ['completed', 'on_hold', 'cancelled'],
                'on_hold': ['processing', 'cancelled'],
                'completed': ['refunded'],
                'cancelled': [],
                'refunded': [],
                'failed': []
            };

            if (!validStatusTransitions[order.status].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot change status from ${order.status} to ${status}`
                });
            }

            // Update status
            order.status = status;

            // Add status history entry
            order.statusHistory.push({
                status,
                timestamp: new Date(),
                updatedBy: {
                    id: actorId,
                    role: actorRole
                },
                notes: notes || null
            });

            // Handle special cases
            if (status === 'cancelled') {
                order.cancelReason = notes;
                order.cancelledAt = new Date();
                order.cancelledBy = actorId;
            }

            await order.save();

            // Get user details for notifications
            const user = await User.findById(order.userId);

            // Get actor details for logging
            let actorName = null;
            if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
            } else {
                const agent = await Agent.findById(actorId);
                actorName = agent ? `${agent.first_name} ${agent.last_name}` : null;
            }

            // Log activity
            await logActivity({
                actorId,
                actorModel: actorRole === 'admin' ? 'Admins' : 'Agents',
                actorName,
                action: 'order_updated',
                entityType: 'Order',
                entityId: order._id,
                description: `Order status changed from ${order.status} to ${status}`,
                adminId: order.adminId,
                status: 'success'
            });

            // Create notifications
            await createNotification({
                title: "Order Status Updated",
                description: `Order ${order.orderNumber} status changed to ${status}`,
                type: 'order',
                priority: 'medium',
                forAdmin: order.adminId,
                relatedTo: {
                    model: 'Order',
                    id: order._id
                }
            });

            // TODO: Notify user via WhatsApp about order status change

            return res.status(200).json({
                success: true,
                message: "Order status updated successfully",
                data: order
            });
        } catch (error) {
            console.error("Error in updateOrderStatus:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update order shipping info
    updateShipping: async (req, res) => {
        try {
            const { id } = req.params;
            const { shipping } = req.body;
            const adminId = req.adminId;

            const order = await Order.findById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (order.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this order"
                });
            }

            // Update shipping information
            if (shipping.trackingNumber) order.shipping.trackingNumber = shipping.trackingNumber;
            if (shipping.carrier) order.shipping.carrier = shipping.carrier;
            if (shipping.status) order.shipping.status = shipping.status;
            if (shipping.estimatedDelivery) order.shipping.estimatedDelivery = shipping.estimatedDelivery;

            // Handle shipping status updates
            if (shipping.status === 'shipped' && !order.shipping.shippedAt) {
                order.shipping.shippedAt = new Date();
            }

            if (shipping.status === 'delivered' && !order.shipping.deliveredAt) {
                order.shipping.deliveredAt = new Date();
                // Auto-complete order if shipping is delivered
                if (order.status === 'processing') {
                    order.status = 'completed';
                    order.statusHistory.push({
                        status: 'completed',
                        timestamp: new Date(),
                        updatedBy: {
                            id: adminId,
                            role: 'admin'
                        },
                        notes: 'Order completed on delivery'
                    });
                }
            }

            await order.save();

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'order_updated',
                entityType: 'Order',
                entityId: order._id,
                description: `Updated shipping information for order ${order.orderNumber}`,
                adminId,
                status: 'success'
            });

            // TODO: Notify user about shipping update

            return res.status(200).json({
                success: true,
                message: "Shipping information updated successfully",
                data: order
            });
        } catch (error) {
            console.error("Error in updateShipping:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Cancel order
    cancelOrder: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const actorId = req.adminId || req.userId;
            const actorRole = req.adminId ? 'admin' : 'user';

            const order = await Order.findById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && order.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to cancel this order"
                });
            }

            if (actorRole === 'user' && order.userId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to cancel this order"
                });
            }

            // Check if order can be cancelled
            if (!['pending', 'processing'].includes(order.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Order cannot be cancelled in its current status"
                });
            }

            // Cancel order
            order.status = 'cancelled';
            order.cancelReason = reason;
            order.cancelledAt = new Date();
            order.cancelledBy = actorId;

            // Add status history entry
            order.statusHistory.push({
                status: 'cancelled',
                timestamp: new Date(),
                updatedBy: {
                    id: actorId,
                    role: actorRole
                },
                notes: reason
            });

            await order.save();

            // Handle payment cancellation/refund if necessary
            const payment = await Payment.findOne({ orderId: order._id });
            if (payment && payment.status === 'completed') {
                // TODO: Process refund
            }

            // Get actor details for logging
            let actorName = null;
            if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
            } else {
                const user = await User.findById(actorId);
                actorName = user ? (user.name || user.phone) : null;
            }

            // Log activity
            await logActivity({
                actorId,
                actorModel: actorRole === 'admin' ? 'Admins' : 'Users',
                actorName,
                action: 'order_cancelled',
                entityType: 'Order',
                entityId: order._id,
                description: `Order ${order.orderNumber} cancelled`,
                adminId: order.adminId,
                status: 'success'
            });

            // Create notifications
            if (actorRole === 'user') {
                await createNotification({
                    title: "Order Cancelled by Customer",
                    description: `Order ${order.orderNumber} was cancelled by customer`,
                    type: 'order',
                    priority: 'high',
                    forAdmin: order.adminId,
                    relatedTo: {
                        model: 'Order',
                        id: order._id
                    }
                });
            }

            return res.status(200).json({
                success: true,
                message: "Order cancelled successfully",
                data: order
            });
        } catch (error) {
            console.error("Error in cancelOrder:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get order analytics
    getOrderAnalytics: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate, campaignId, agentId } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Base query
            const baseQuery = { adminId, ...dateFilter };
            if (campaignId) baseQuery.campaignId = campaignId;
            if (agentId) baseQuery.agentId = agentId;

            // Get total orders
            const totalOrders = await Order.countDocuments(baseQuery);

            // Get orders by status
            const ordersByStatus = await Order.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            // Get total revenue
            const revenueData = await Order.aggregate([
                { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$totalAmount" },
                        totalTax: { $sum: "$taxAmount" },
                        totalDiscount: { $sum: "$discountAmount" },
                        totalShipping: { $sum: "$shippingAmount" }
                    }
                }
            ]);

            // Get average order value
            const avgOrderValue = totalOrders > 0 && revenueData[0] 
                ? revenueData[0].totalRevenue / totalOrders 
                : 0;

            // Get orders by payment method
            const ordersByPaymentMethod = await Order.aggregate([
                { $match: baseQuery },
                { $group: { _id: "$payment.method", count: { $sum: 1 } } }
            ]);

            // Get orders by campaign
            const ordersByCampaign = await Order.aggregate([
                { $match: { ...baseQuery, campaignId: { $ne: null } } },
                { $group: { _id: "$campaignId", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
                { $sort: { revenue: -1 } },
                { $limit: 5 }
            ]);

            // Get campaign details
            const campaignIds = ordersByCampaign.map(item => item._id);
            const campaigns = await Campaign.find({ _id: { $in: campaignIds } }, { name: 1 });

            // Map campaign details
            const campaignsWithDetails = ordersByCampaign.map(item => {
                const campaign = campaigns.find(c => c._id.toString() === item._id.toString());
                return {
                    campaignId: item._id,
                    name: campaign ? campaign.name : 'Unknown Campaign',
                    orderCount: item.count,
                    revenue: item.revenue
                };
            });

            // Get daily order count
            const dailyOrders = await Order.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" }
                        },
                        count: { $sum: 1 },
                        revenue: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]);

            // Format daily orders
            const formattedDailyOrders = dailyOrders.map(item => ({
                date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
                count: item.count,
                revenue: item.revenue
            }));

            // Get conversion rate (completed orders / total orders)
            const completedOrders = ordersByStatus.find(item => item._id === 'completed')?.count || 0;
            const conversionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

            // Get top products
            const topProducts = await Order.aggregate([
                { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
                { $unwind: "$products" },
                {
                    $group: {
                        _id: "$products.productId",
                        name: { $first: "$products.name" },
                        soldQuantity: { $sum: "$products.quantity" },
                        revenue: { $sum: "$products.subtotal" }
                    }
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    totalOrders,
                    totalRevenue: revenueData[0]?.totalRevenue || 0,
                    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
                    conversionRate: parseFloat(conversionRate.toFixed(2)),
                    ordersByStatus: ordersByStatus.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    ordersByPaymentMethod: ordersByPaymentMethod.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {}),
                    topCampaigns: campaignsWithDetails,
                    topProducts,
                    dailyOrders: formattedDailyOrders,
                    taxData: {
                        totalTax: revenueData[0]?.totalTax || 0,
                        totalDiscount: revenueData[0]?.totalDiscount || 0,
                        totalShipping: revenueData[0]?.totalShipping || 0
                    }
                }
            });
        } catch (error) {
            console.error("Error in getOrderAnalytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get user orders (for users themselves)
    getUserOrders: async (req, res) => {
        try {
            const userId = req.userId;
            const { status, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

            // Build query
            const query = { userId };

            if (status) query.status = status;

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Order.countDocuments(query);

            // Execute query with pagination
            const orders = await Order.find(query)
                .populate('products.productId', 'name description')
                .select('-notes.internal -notes.admin') // Hide internal and admin notes from users
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: orders,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getUserOrders:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Generate invoice for order
    generateInvoice: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const order = await Order.findById(id)
                .populate('userId', 'name phone email_id')
                .populate('adminId', 'business_name email_id mobile');

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (order.adminId._id.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to generate invoice for this order"
                });
            }

            // Check if invoice already exists
            let invoice = await Invoice.findOne({ orderId: order._id });

            if (invoice) {
                return res.status(200).json({
                    success: true,
                    message: "Invoice already exists",
                    data: invoice
                });
            }

            // Generate invoice number
            const invoiceNumber = await Invoice.generateInvoiceNumber(adminId);

            // Create invoice
            invoice = new Invoice({
                invoiceNumber,
                orderId: order._id,
                userId: order.userId._id,
                adminId: order.adminId._id,
                customerInfo: {
                    name: order.userId.name || 'Customer',
                    phone: order.userId.phone,
                    email: order.userId.email_id,
                    addressLine1: order.shipping?.address?.street,
                    city: order.shipping?.address?.city,
                    state: order.shipping?.address?.state,
                    pincode: order.shipping?.address?.zipCode,
                    country: order.shipping?.address?.country || 'India'
                },
                sellerInfo: {
                    name: order.adminId.business_name,
                    email: order.adminId.email_id,
                    phone: order.adminId.mobile,
                    // Add more seller info as needed
                },
                items: order.products.map(product => ({
                    name: product.name,
                    quantity: product.quantity,
                    unitPrice: product.price,
                    totalPrice: product.subtotal,
                    taxRate: product.tax.rate,
                    taxAmount: product.tax.amount,
                    productId: product.productId,
                    hsn: product.hsn,
                    sku: product.sku
                })),
                subtotal: order.totalAmount,
                taxTotal: order.taxAmount,
                discountTotal: order.discountAmount,
                shippingTotal: order.shippingAmount,
                grandTotal: order.totalAmount + order.taxAmount - order.discountAmount + order.shippingAmount,
                currency: order.currency,
                invoiceDate: new Date(),
                status: 'sent',
                paymentStatus: order.payment.status === 'completed' ? 'paid' : 'unpaid',
                isGstInvoice: true // Adjust based on your requirements
            });

            await invoice.save();

            // Update order with invoice reference
            order.invoiceNumber = invoiceNumber;
            order.invoiceUrl = invoice.pdfUrl; // Set after PDF generation
            await order.save();

            // Log activity
            const admin = await Admin.findById(adminId);
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'invoice_generated',
                entityType: 'Invoice',
                entityId: invoice._id,
                description: `Invoice generated for order ${order.orderNumber}`,
                adminId,
                status: 'success'
            });

            return res.status(201).json({
                success: true,
                message: "Invoice generated successfully",
                data: invoice
            });
        } catch (error) {
            console.error("Error in generateInvoice:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update order notes
    updateOrderNotes: async (req, res) => {
        try {
            const { id } = req.params;
            const { customer, admin, internal } = req.body;
            const actorId = req.adminId || req.agentId;
            const actorRole = req.adminId ? 'admin' : 'agent';

            const order = await Order.findById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin' && order.adminId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this order"
                });
            }

            if (actorRole === 'agent' && order.agentId && order.agentId.toString() !== actorId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this order"
                });
            }

            // Update notes
            if (!order.notes) {
                order.notes = {};
            }

            if (customer !== undefined) order.notes.customer = customer;
            if (admin !== undefined) order.notes.admin = admin;
            if (internal !== undefined) order.notes.internal = internal;

            await order.save();

            return res.status(200).json({
                success: true,
                message: "Order notes updated successfully",
                data: order
            });
        } catch (error) {
            console.error("Error in updateOrderNotes:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = OrderController;