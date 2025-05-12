// models/Invoices.js (Fixed version)
const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: null
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    taxRate: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discountRate: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products',
        default: null
    },
    hsn: {
        type: String,
        default: null // HSN code for GST
    },
    sku: {
        type: String,
        default: null // Product SKU
    }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true  // This already creates an index
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Orders',
        default: null
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
    customerInfo: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            default: null
        },
        phone: {
            type: String,
            required: true
        },
        addressLine1: {
            type: String,
            default: null
        },
        addressLine2: {
            type: String,
            default: null
        },
        city: {
            type: String,
            default: null
        },
        state: {
            type: String,
            default: null
        },
        pincode: {
            type: String,
            default: null
        },
        country: {
            type: String,
            default: 'India'
        },
        gstin: {
            type: String,
            default: null // Customer GSTIN if applicable
        }
    },
    sellerInfo: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            default: null
        },
        phone: {
            type: String,
            default: null
        },
        addressLine1: {
            type: String,
            default: null
        },
        addressLine2: {
            type: String,
            default: null
        },
        city: {
            type: String,
            default: null
        },
        state: {
            type: String,
            default: null
        },
        pincode: {
            type: String,
            default: null
        },
        country: {
            type: String,
            default: 'India'
        },
        gstin: {
            type: String,
            default: null // Seller GSTIN
        },
        pan: {
            type: String,
            default: null // Seller PAN
        },
        companyId: {
            type: String,
            default: null // Company registration number
        }
    },
    items: [invoiceItemSchema],
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    taxTotal: {
        type: Number,
        default: 0
    },
    discountTotal: {
        type: Number,
        default: 0
    },
    shippingTotal: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true,
        min: 0
    },
    amountDue: {
        type: Number,
        default: function() {
            return this.grandTotal;
        }
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    invoiceDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    dueDate: {
        type: Date,
        default: function() {
            const date = new Date(this.invoiceDate);
            date.setDate(date.getDate() + 30); // Default 30 days from invoice date
            return date;
        }
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
        default: 'draft'
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'partially_paid', 'paid', 'refunded'],
        default: 'unpaid'
    },
    paymentDetails: [{
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payments'
        },
        amount: Number,
        date: Date,
        method: String,
        reference: String,
        notes: String
    }],
    notes: {
        type: String,
        default: null
    },
    terms: {
        type: String,
        default: null
    },
    isGstInvoice: {
        type: Boolean,
        default: true
    },
    taxDetails: {
        igst: {
            type: Number,
            default: 0
        },
        cgst: {
            type: Number,
            default: 0
        },
        sgst: {
            type: Number,
            default: 0
        },
        cess: {
            type: Number,
            default: 0
        }
    },
    placeOfSupply: {
        type: String,
        default: null // State code
    },
    reverseCharge: {
        type: Boolean,
        default: false
    },
    invoiceType: {
        type: String,
        enum: ['regular', 'proforma', 'credit_note', 'debit_note'],
        default: 'regular'
    },
    referenceInvoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoices',
        default: null // For credit notes or debit notes
    },
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],
    logo: {
        type: String,
        default: null // URL to company logo
    },
    signature: {
        type: String,
        default: null // URL to signature image
    },
    paymentLink: {
        type: String,
        default: null
    },
    publicAccessUrl: {
        type: String,
        default: null
    },
    pdfUrl: {
        type: String,
        default: null
    },
    generatedBy: {
        type: String,
        enum: ['system', 'admin', 'agent', 'superadmin'],
        default: 'system'
    },
    viewedAt: {
        type: Date,
        default: null
    },
    paidAt: {
        type: Date,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    sentAt: {
        type: Date,
        default: null
    },
    communicationHistory: [{
        type: {
            type: String,
            enum: ['email', 'whatsapp', 'sms', 'manual'],
            required: true
        },
        sentAt: {
            type: Date,
            default: Date.now
        },
        recipient: String,
        subject: String,
        content: String,
        sentBy: {
            id: mongoose.Schema.Types.ObjectId,
            role: String
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'failed', 'opened'],
            default: 'sent'
        }
    }],
    metadata: {
        type: Object,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
// REMOVED: invoiceSchema.index({ invoiceNumber: 1 }); // This is duplicate - unique: true already creates an index
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ adminId: 1, status: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ status: 1, paymentStatus: 1 });

// Static method for generating invoice numbers
invoiceSchema.statics.generateInvoiceNumber = async function(adminId, prefix = 'INV') {
    const admin = await mongoose.model('Admins').findById(adminId);
    
    // Use admin's business name initial if available
    if (admin && admin.business_name) {
        const businessInitials = admin.business_name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
        
        prefix = businessInitials || prefix;
    }
    
    const date = new Date();
    const financialYear = date.getMonth() >= 3 
        ? `${date.getFullYear()}-${date.getFullYear() + 1 - 2000}`
        : `${date.getFullYear() - 1}-${date.getFullYear() - 2000}`;
    
    // Find the highest invoice number for this admin and financial year
    const pattern = `^${prefix}/${financialYear}/`;
    const latestInvoice = await this.findOne(
        { 
            adminId,
            invoiceNumber: new RegExp(pattern)
        },
        { invoiceNumber: 1 },
        { sort: { invoiceNumber: -1 } }
    );
    
    let sequentialNumber = 1;
    if (latestInvoice && latestInvoice.invoiceNumber) {
        const parts = latestInvoice.invoiceNumber.split('/');
        const lastNumber = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNumber)) {
            sequentialNumber = lastNumber + 1;
        }
    }
    
    // Format with 4 digits for the sequential part
    return `${prefix}/${financialYear}/${sequentialNumber.toString().padStart(4, '0')}`;
};

// Method to calculate totals
invoiceSchema.methods.calculateTotals = function() {
    // Calculate item totals
    this.items.forEach(item => {
        item.totalPrice = item.quantity * item.unitPrice;
        item.taxAmount = (item.totalPrice * item.taxRate) / 100;
        item.discountAmount = (item.totalPrice * item.discountRate) / 100;
    });
    
    // Calculate invoice totals
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxTotal = this.items.reduce((sum, item) => sum + item.taxAmount, 0);
    this.discountTotal = this.items.reduce((sum, item) => sum + item.discountAmount, 0);
    this.grandTotal = this.subtotal + this.taxTotal - this.discountTotal + this.shippingTotal;
    this.amountDue = this.grandTotal - this.amountPaid;
    
    // Update payment status based on amounts
    if (this.amountPaid === 0) {
        this.paymentStatus = 'unpaid';
    } else if (this.amountPaid < this.grandTotal) {
        this.paymentStatus = 'partially_paid';
    } else {
        this.paymentStatus = 'paid';
    }
    
    return this;
};

// Method to mark invoice as sent
invoiceSchema.methods.markAsSent = async function() {
    this.status = 'sent';
    this.sentAt = new Date();
    await this.save();
    return this;
};

// Method to mark invoice as paid
invoiceSchema.methods.markAsPaid = async function(paymentDetails) {
    if (paymentDetails) {
        this.paymentDetails.push(paymentDetails);
        this.amountPaid += paymentDetails.amount;
    } else {
        this.amountPaid = this.grandTotal;
    }
    
    if (this.amountPaid >= this.grandTotal) {
        this.status = 'paid';
        this.paymentStatus = 'paid';
        this.paidAt = new Date();
    } else {
        this.status = 'partially_paid';
        this.paymentStatus = 'partially_paid';
    }
    
    this.amountDue = Math.max(0, this.grandTotal - this.amountPaid);
    
    await this.save();
    return this;
};

const Invoice = mongoose.model('Invoices', invoiceSchema);
module.exports = { Invoice };