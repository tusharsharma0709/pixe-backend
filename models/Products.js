// models/Products.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
    price: {
        type: Number,
        required: true
    },
    categoryId: {
        type: String,
        default: null  // Facebook product catalog category ID
    },
    catalogId: {
        type: String,
        default: null  // Facebook product catalog ID
    },
    facebookProductId: {
        type: String,
        default: null  // ID of the product in Facebook catalog
    },
    status: {
        type: String,
        enum: ['requested', 'under_review', 'approved', 'active', 'inactive', 'rejected'],
        default: 'requested'
    },
    images: [{
        type: String  // URLs to product images
    }],
    productDetails: {
        type: Object,
        default: {}  // Additional product details/attributes
    },
    inventory: {
        type: Number,
        default: 0
    },
    superAdminNotes: {
        type: String,
        default: null
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    }
}, { 
    timestamps: true 
});

// Add index for faster queries
productSchema.index({ adminId: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });

const Product = mongoose.model('Products', productSchema);
module.exports = { Product };