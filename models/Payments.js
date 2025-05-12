// models/Payments.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Orders',
        default: null
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSessions',
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    paymentMethod: {
        type: String,
        enum: ['facebook_pay', 'credit_card', 'debit_card', 'upi', 'netbanking', 'wallet', 'bank_transfer', 'cod', 'razorpay', 'other'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        default: null
    },
    paymentProvider: {
        type: String,
        default: 'facebook'
    },
    paymentGateway: {
        type: String,
        default: null
    },
    paymentSource: {
        type: String,
        enum: ['whatsapp', 'web', 'app', 'manual'],
        default: 'whatsapp'
    },
    feeAmount: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    netAmount: {
        type: Number,
        default: function() {
            return this.amount - this.feeAmount - this.taxAmount;
        }
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    settledAt: {
        type: Date,
        default: null
    },
    description: {
        type: String,
        default: null
    },
    metadata: {
        type: Object,
        default: null
    },
    gatewayResponse: {
        type: Object,
        default: null
    },
    errorCode: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    cardInfo: {
        last4: {
            type: String,
            default: null
        },
        brand: {
            type: String,
            default: null
        },
        country: {
            type: String,
            default: null
        },
        expiryMonth: {
            type: String,
            default: null
        },
        expiryYear: {
            type: String,
            default: null
        }
    },
    billingAddress: {
        name: String,
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        phone: String
    },
    refunds: [{
        refundId: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        },
        initiatedBy: {
            id: mongoose.Schema.Types.ObjectId,
            role: String
        },
        refundedAt: {
            type: Date,
            default: Date.now
        },
        gatewayResponse: {
            type: Object,
            default: null
        },
        notes: {
            type: String,
            default: null
        }
    }],
    captures: [{
        captureId: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        capturedAt: {
            type: Date,
            default: Date.now
        },
        gatewayResponse: {
            type: Object,
            default: null
        }
    }],
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
    }],
    receiptUrl: {
        type: String,
        default: null
    },
    receiptEmail: {
        type: String,
        default: null
    },
    invoiceId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries - removed duplicate paymentId index
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ adminId: 1, status: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ 'refunds.refundId': 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1, paymentDate: -1 });
paymentSchema.index({ paymentMethod: 1, status: 1 });

const Payment = mongoose.model('Payments', paymentSchema);
module.exports = { Payment };