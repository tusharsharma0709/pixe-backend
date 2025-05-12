// models/ProductCatalogs.js
const mongoose = require('mongoose');

const productCatalogSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    facebookCatalogId: {
        type: String,
        default: null
    },
    facebookCatalogUrl: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'inactive', 'rejected'],
        default: 'draft'
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
    isDefault: {
        type: Boolean,
        default: false
    },
    category: {
        type: String,
        default: 'general'
    },
    productCount: {
        type: Number,
        default: 0
    },
    settings: {
        currencyCode: {
            type: String,
            default: 'INR'
        },
        isDigitalOnly: {
            type: Boolean,
            default: false
        },
        hasVariants: {
            type: Boolean,
            default: false
        },
        taxRate: {
            type: Number,
            default: 0
        }
    },
    integrations: {
        facebookPage: {
            type: String,
            default: null
        },
        instagramAccount: {
            type: String,
            default: null
        },
        whatsappBusinessAccount: {
            type: String,
            default: null
        }
    },
    rejectionReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
productCatalogSchema.index({ adminId: 1, status: 1 });
productCatalogSchema.index({ facebookCatalogId: 1 });
productCatalogSchema.index({ superAdminId: 1, createdAt: -1 });

const ProductCatalog = mongoose.model('ProductCatalogs', productCatalogSchema);
module.exports = { ProductCatalog };