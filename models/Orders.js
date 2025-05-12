// models/Orders.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    variant: {
        type: Object,
        default: null
    },
    tax: {
        rate: {
            type: Number,
            default: 0
        },
        amount: {
            type: Number,
            default: 0
        }
    },
    discount: {
        type: Number,
        default: 0
    },
    subtotal: {
        type: Number,
        required: true
    }
}, { _id: true });

const paymentSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['facebook_pay', 'bank_transfer', 'cod', 'credit_card', 'debit_card', 'upi', 'wallet', 'other'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'],
        default: 'pending'
    },
    amount: {
        type: Number,
        required: true
    },
    transactionId: {
        type: String,
        default: null
    },
    facebookPaymentId: {
        type: String,
        default: null
    },
    paymentProvider: {
        type: String,
        default: 'facebook'
    },
    paymentDate: {
        type: Date,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    },
    gatewayResponse: {
        type: Object,
        default: null
    },
    refunds: [{
        amount: Number,
        reason: String,
        refundId: String,
        refundedAt: Date,
        refundedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admins'
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        }
    }]
}, { _id: true });

const shippingSchema = new mongoose.Schema({
    address: {
        name: String,
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        phone: String
    },
    method: {
        type: String,
        default: 'standard'
    },
    trackingNumber: {
        type: String,
        default: null
    },
    carrier: {
        type: String,
        default: null
    },
    cost: {
        type: Number,
        default: 0
    },
    estimatedDelivery: {
        type: Date,
        default: null
    },
    shippedAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'failed', 'returned', 'cancelled'],
        default: 'pending'
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        default: null
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaigns',
        default: null
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null
    },
    products: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    shippingAmount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'on_hold', 'failed'],
        default: 'pending'
    },
    payment: paymentSchema,
    shipping: shippingSchema,
    isDigitalOnly: {
        type: Boolean,
        default: false
    },
    notes: {
        customer: {
            type: String,
            default: null
        },
        admin: {
            type: String,
            default: null
        },
        internal: {
            type: String,
            default: null
        }
    },
    facebookOrderId: {
        type: String,
        default: null
    },
    invoiceNumber: {
        type: String,
        default: null
    },
    invoiceUrl: {
        type: String,
        default: null
    },
    cancelReason: {
        type: String,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    tags: [{
        type: String
    }],
    metadata: {
        type: Object,
        default: null
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        updatedBy: {
            id: mongoose.Schema.Types.ObjectId,
            role: String
        },
        notes: String
    }]
}, {
    timestamps: true
});

// Add indexes for faster queries - removed duplicate orderNumber index
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ adminId: 1, status: 1, createdAt: -1 });
orderSchema.index({ agentId: 1, status: 1 });
orderSchema.index({ 'payment.status': 1, status: 1 });
orderSchema.index({ 'shipping.status': 1, status: 1 });
orderSchema.index({ createdAt: -1 });

// Helper method for generating order numbers
orderSchema.statics.generateOrderNumber = async function() {
    const prefix = 'ORD';
    const date = new Date();
    const datePart = date.getFullYear().toString().substr(-2) + 
                    (date.getMonth() + 1).toString().padStart(2, '0') + 
                    date.getDate().toString().padStart(2, '0');
    
    // Find the highest order number for today
    const latestOrder = await this.findOne(
        { orderNumber: new RegExp(`^${prefix}${datePart}`) },
        { orderNumber: 1 },
        { sort: { orderNumber: -1 } }
    );
    
    let sequentialNumber = 1;
    if (latestOrder && latestOrder.orderNumber) {
        const currentSequence = parseInt(latestOrder.orderNumber.substring(7), 10);
        if (!isNaN(currentSequence)) {
            sequentialNumber = currentSequence + 1;
        }
    }
    
    // Format with 4 digits for the sequential part
    return `${prefix}${datePart}${sequentialNumber.toString().padStart(4, '0')}`;
};

const Order = mongoose.model('Orders', orderSchema);
module.exports = { Order };