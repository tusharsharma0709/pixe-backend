// models/ProductRequests.js
const mongoose = require('mongoose');

const productAttributeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    }
}, { _id: false });

const productRequestSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        default: null
    },
    currency: {
        type: String,
        default: 'INR'
    },
    category: {
        type: String,
        default: 'general'
    },
    subCategory: {
        type: String,
        default: null
    },
    brand: {
        type: String,
        default: null
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        caption: {
            type: String,
            default: null
        }
    }],
    attributes: [productAttributeSchema],
    inventory: {
        quantity: {
            type: Number,
            default: 0
        },
        sku: {
            type: String,
            default: null
        },
        managementType: {
            type: String,
            enum: ['none', 'manual', 'automatic'],
            default: 'manual'
        }
    },
    shipping: {
        weight: {
            type: Number,
            default: null
        },
        weightUnit: {
            type: String,
            enum: ['g', 'kg', 'lb', 'oz'],
            default: 'g'
        },
        dimensions: {
            length: { type: Number, default: null },
            width: { type: Number, default: null },
            height: { type: Number, default: null },
            unit: { 
                type: String, 
                enum: ['cm', 'in'], 
                default: 'cm' 
            }
        },
        shippingClass: {
            type: String,
            default: 'standard'
        }
    },
    isDigital: {
        type: Boolean,
        default: false
    },
    hasVariants: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'published'],
        default: 'draft'
    },
    catalogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductCatalogs',
        default: null
    },
    rejectionReason: {
        type: String,
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    superAdminNotes: {
        type: String,
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    publishedProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products',
        default: null
    },
    facebookRetailerId: {
        type: String,
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    },
    taxable: {
        type: Boolean,
        default: true
    },
    taxClass: {
        type: String,
        default: 'standard'
    },
    taxRate: {
        type: Number,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
productRequestSchema.index({ adminId: 1, status: 1 });
productRequestSchema.index({ superAdminId: 1, status: 1 });
productRequestSchema.index({ status: 1, createdAt: -1 });
productRequestSchema.index({ catalogId: 1, status: 1 });

const ProductRequest = mongoose.model('ProductRequests', productRequestSchema);
module.exports = { ProductRequest };