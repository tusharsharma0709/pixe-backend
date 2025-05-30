// models/ProductRequests.js - Updated with comprehensive enum values
const mongoose = require('mongoose');

const productAttributeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    value: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    type: {
        type: String,
        enum: ['text', 'number', 'boolean', 'date', 'color', 'size', 'custom'],
        default: 'text'
    },
    unit: {
        type: String,
        maxlength: 20
    }
}, { _id: false });

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Image URL must be a valid HTTP/HTTPS URL'
        }
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    caption: {
        type: String,
        maxlength: 200,
        default: null
    },
    altText: {
        type: String,
        maxlength: 100
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    sku: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
    },
    barcode: {
        type: String,
        trim: true,
        maxlength: 100
    },
    managementType: {
        type: String,
        enum: ['none', 'manual', 'automatic', 'backorder', 'pre_order'],
        default: 'manual'
    },
    lowStockThreshold: {
        type: Number,
        min: 0,
        default: 5
    },
    allowBackorders: {
        type: Boolean,
        default: false
    },
    trackQuantity: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const shippingSchema = new mongoose.Schema({
    weight: {
        type: Number,
        min: 0,
        default: null
    },
    weightUnit: {
        type: String,
        enum: ['g', 'kg', 'lb', 'oz'],
        default: 'kg'
    },
    dimensions: {
        length: { 
            type: Number, 
            min: 0,
            default: null 
        },
        width: { 
            type: Number, 
            min: 0,
            default: null 
        },
        height: { 
            type: Number, 
            min: 0,
            default: null 
        },
        unit: { 
            type: String, 
            enum: ['cm', 'in', 'm'], 
            default: 'cm' 
        }
    },
    shippingClass: {
        type: String,
        enum: [
            'standard',
            'express',
            'overnight',
            'free_shipping',
            'heavy_item',
            'fragile',
            'oversized',
            'digital_delivery',
            'pickup_only',
            'custom'
        ],
        default: 'standard'
    },
    requiresSpecialHandling: {
        type: Boolean,
        default: false
    },
    handlingInstructions: {
        type: String,
        maxlength: 500
    }
}, { _id: false });

const pricingSchema = new mongoose.Schema({
    basePrice: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: null
    },
    costPrice: {
        type: Number,
        min: 0,
        default: null
    },
    msrp: { // Manufacturer Suggested Retail Price
        type: Number,
        min: 0,
        default: null
    },
    currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'],
        default: 'INR'
    },
    priceType: {
        type: String,
        enum: ['fixed', 'variable', 'negotiable', 'quote_based'],
        default: 'fixed'
    },
    bulkPricing: [{
        minQuantity: Number,
        maxQuantity: Number,
        price: Number,
        discountPercentage: Number
    }]
}, { _id: false });

const productRequestSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 5000
    },
    shortDescription: {
        type: String,
        trim: true,
        maxlength: 500
    },
    // Updated pricing structure
    price: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: null
    },
    costPrice: {
        type: Number,
        min: 0,
        default: null
    },
    currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'],
        default: 'INR'
    },
    // Enhanced categorization
    category: {
        type: String,
        enum: [
            'general',
            'fashion_apparel',
            'electronics_gadgets',
            'home_garden',
            'health_beauty',
            'sports_outdoors',
            'automotive',
            'books_media',
            'toys_games',
            'food_beverage',
            'jewelry_accessories',
            'business_industrial',
            'art_collectibles',
            'baby_kids',
            'pet_supplies',
            'services',
            'digital_products',
            'software',
            'courses_education',
            'handmade_crafts',
            'vintage_antiques',
            'real_estate',
            'travel_experiences',
            'custom'
        ],
        default: 'general'
    },
    subCategory: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
    },
    brand: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
    },
    manufacturer: {
        type: String,
        trim: true,
        maxlength: 100
    },
    model: {
        type: String,
        trim: true,
        maxlength: 100
    },
    images: {
        type: [imageSchema],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'At least one product image is required'
        }
    },
    attributes: [productAttributeSchema],
    inventory: {
        type: inventorySchema,
        default: () => ({})
    },
    shipping: {
        type: shippingSchema,
        default: () => ({})
    },
    // Product type and characteristics
    productType: {
        type: String,
        enum: [
            'physical',
            'digital',
            'service',
            'subscription',
            'bundle',
            'gift_card',
            'course',
            'software',
            'rental',
            'custom'
        ],
        default: 'physical'
    },
    isDigital: {
        type: Boolean,
        default: false
    },
    hasVariants: {
        type: Boolean,
        default: false
    },
    isFragile: {
        type: Boolean,
        default: false
    },
    isPerishable: {
        type: Boolean,
        default: false
    },
    ageRestricted: {
        type: Boolean,
        default: false
    },
    minimumAge: {
        type: Number,
        min: 0,
        max: 100
    },
    // Status and workflow
    status: {
        type: String,
        enum: [
            'draft',
            'submitted',
            'under_review',
            'approved',
            'rejected',
            'published',
            'archived',
            'suspended',
            'needs_revision',
            'expired'
        ],
        default: 'draft',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    catalogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductCatalogs',
        required: true,
        index: true
    },
    rejectionReason: {
        type: String,
        maxlength: 1000,
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    superAdminNotes: {
        type: String,
        maxlength: 1000,
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
        trim: true,
        default: null
    },
    adminNotes: {
        type: String,
        maxlength: 1000,
        default: null
    },
    // Tax information
    taxable: {
        type: Boolean,
        default: true
    },
    taxClass: {
        type: String,
        enum: [
            'standard',
            'reduced',
            'zero',
            'exempt',
            'luxury',
            'digital_services',
            'food_beverage',
            'medical',
            'educational',
            'custom'
        ],
        default: 'standard'
    },
    taxRate: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    hsnCode: { // Harmonized System Nomenclature Code for India
        type: String,
        trim: true,
        maxlength: 20
    },
    // SEO and marketing
    seo: {
        metaTitle: {
            type: String,
            maxlength: 60
        },
        metaDescription: {
            type: String,
            maxlength: 160
        },
        keywords: [String],
        slug: {
            type: String,
            maxlength: 200
        }
    },
    // Availability and scheduling
    availability: {
        type: String,
        enum: [
            'in_stock',
            'out_of_stock',
            'pre_order',
            'backorder',
            'discontinued',
            'coming_soon',
            'limited_edition',
            'seasonal'
        ],
        default: 'in_stock'
    },
    availableFrom: {
        type: Date,
        default: null
    },
    availableUntil: {
        type: Date,
        default: null
    },
    // Compliance and certifications
    compliance: {
        requiresLicense: {
            type: Boolean,
            default: false
        },
        certifications: [String],
        safetyWarnings: [String],
        restrictedCountries: [String],
        ageVerificationRequired: {
            type: Boolean,
            default: false
        }
    },
    // Quality and condition
    condition: {
        type: String,
        enum: [
            'new',
            'used_like_new',
            'used_very_good',
            'used_good',
            'used_acceptable',
            'refurbished',
            'damaged',
            'parts_only',
            'custom'
        ],
        default: 'new'
    },
    warranty: {
        hasWarranty: {
            type: Boolean,
            default: false
        },
        warrantyPeriod: {
            type: Number, // in months
            min: 0
        },
        warrantyType: {
            type: String,
            enum: ['manufacturer', 'seller', 'extended', 'none'],
            default: 'none'
        },
        warrantyDescription: {
            type: String,
            maxlength: 500
        }
    },
    // Review and rating placeholders
    expectedRating: {
        type: Number,
        min: 0,
        max: 5,
        default: null
    },
    competitorAnalysis: {
        competitorPrices: [{
            competitor: String,
            price: Number,
            url: String
        }],
        averageMarketPrice: Number,
        pricePosition: {
            type: String,
            enum: ['below_market', 'at_market', 'above_market', 'premium'],
            default: 'at_market'
        }
    },
    // Internal tracking
    internalSku: {
        type: String,
        trim: true,
        maxlength: 100
    },
    supplierInfo: {
        supplierName: String,
        supplierSku: String,
        supplierPrice: Number,
        leadTime: Number, // in days
        minimumOrderQuantity: Number
    },
    // Version control
    version: {
        type: Number,
        default: 1
    },
    originalRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductRequests',
        default: null
    },
    // Tags and labels
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    // Feature flags
    features: {
        isFeatured: {
            type: Boolean,
            default: false
        },
        isNewArrival: {
            type: Boolean,
            default: false
        },
        isBestseller: {
            type: Boolean,
            default: false
        },
        isOnSale: {
            type: Boolean,
            default: false
        },
        isLimitedStock: {
            type: Boolean,
            default: false
        }
    },
    // Expiry and lifecycle
    expiresAt: {
        type: Date,
        default: function() {
            // Auto-expire draft products after 60 days
            return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        }
    },
    lastModifiedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'lastModifiedBy.userModel'
        },
        userModel: {
            type: String,
            enum: ['Admins', 'SuperAdmins']
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    // Approval workflow
    approvalWorkflow: {
        requiresContentReview: {
            type: Boolean,
            default: true
        },
        requiresLegalReview: {
            type: Boolean,
            default: false
        },
        requiresComplianceCheck: {
            type: Boolean,
            default: false
        },
        customApprovalSteps: [String]
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    }
}, {
    timestamps: true,
    collection: 'product_requests'
});

// Indexes for better query performance
productRequestSchema.index({ adminId: 1, status: 1 });
productRequestSchema.index({ superAdminId: 1, status: 1 });
productRequestSchema.index({ status: 1, createdAt: -1 });
productRequestSchema.index({ catalogId: 1, status: 1 });
productRequestSchema.index({ category: 1, status: 1 });
productRequestSchema.index({ brand: 1 });
productRequestSchema.index({ 'inventory.sku': 1 });
productRequestSchema.index({ internalSku: 1 });
productRequestSchema.index({ priority: 1, status: 1 });
productRequestSchema.index({ isDeleted: 1, status: 1 });
productRequestSchema.index({ expiresAt: 1 });
productRequestSchema.index({ availability: 1 });
productRequestSchema.index({ productType: 1, category: 1 });

// Virtual for discount percentage
productRequestSchema.virtual('discountPercentage').get(function() {
    if (this.salePrice && this.price && this.salePrice < this.price) {
        return Math.round(((this.price - this.salePrice) / this.price) * 100);
    }
    return 0;
});

// Virtual for primary image
productRequestSchema.virtual('primaryImage').get(function() {
    if (this.images && this.images.length > 0) {
        const primary = this.images.find(img => img.isPrimary);
        return primary ? primary.url : this.images[0].url;
    }
    return null;
});

// Virtual for estimated profit margin
productRequestSchema.virtual('profitMargin').get(function() {
    if (this.costPrice && this.price) {
        const effectivePrice = this.salePrice || this.price;
        if (effectivePrice > this.costPrice) {
            return Math.round(((effectivePrice - this.costPrice) / effectivePrice) * 100);
        }
    }
    return null;
});

// Virtual for stock status
productRequestSchema.virtual('stockStatus').get(function() {
    if (!this.inventory || !this.inventory.trackQuantity) return 'unlimited';
    
    if (this.inventory.quantity <= 0) return 'out_of_stock';
    if (this.inventory.quantity <= this.inventory.lowStockThreshold) return 'low_stock';
    return 'in_stock';
});

// Pre-save middleware
productRequestSchema.pre('save', function(next) {
    // Ensure only one primary image
    if (this.images && this.images.length > 0) {
        const primaryImages = this.images.filter(img => img.isPrimary);
        if (primaryImages.length === 0) {
            this.images[0].isPrimary = true;
        } else if (primaryImages.length > 1) {
            this.images.forEach((img, index) => {
                img.isPrimary = index === 0;
            });
        }
        
        // Set sort order if not provided
        this.images.forEach((img, index) => {
            if (img.sortOrder === undefined || img.sortOrder === null) {
                img.sortOrder = index;
            }
        });
    }
    
    // Auto-generate SEO slug if not provided
    if (!this.seo.slug && this.name) {
        this.seo.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    // Set isOnSale feature flag
    if (this.features) {
        this.features.isOnSale = !!(this.salePrice && this.salePrice < this.price);
    }
    
    // Update lastModifiedBy if this is an update
    if (!this.isNew) {
        this.lastModifiedBy = {
            userId: this.adminId, // This might need to be updated based on who's actually modifying
            userModel: 'Admins',
            timestamp: new Date()
        };
    }
    
    next();
});

// Static method to get products by status and category
productRequestSchema.statics.getByStatusAndCategory = function(status, category = null, adminId = null) {
    const query = { status, isDeleted: false };
    if (category) query.category = category;
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name email_id')
        .populate('catalogId', 'name category')
        .populate('superAdminId', 'first_name last_name')
        .sort({ createdAt: -1 });
};

// Static method to get pending approvals with priority
productRequestSchema.statics.getPendingApprovals = function() {
    return this.find({ 
        status: { $in: ['submitted', 'under_review'] },
        isDeleted: false
    })
        .populate('adminId', 'first_name last_name business_name email_id')
        .populate('catalogId', 'name')
        .sort({ priority: -1, createdAt: 1 }); // High priority first, then FIFO
};

// Static method to get products needing attention
productRequestSchema.statics.getProductsNeedingAttention = function(adminId = null) {
    const query = {
        isDeleted: false,
        $or: [
            { status: 'needs_revision' },
            { status: 'rejected' },
            { 'inventory.quantity': { $lte: '$inventory.lowStockThreshold' } },
            { expiresAt: { $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, // Expiring in 7 days
            { images: { $size: 0 } } // No images
        ]
    };
    
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name')
        .populate('catalogId', 'name')
        .sort({ priority: -1, createdAt: -1 });
};

// Method to submit for review
productRequestSchema.methods.submitForReview = function() {
    // Validation before submission
    const errors = [];
    
    if (!this.name || this.name.trim() === '') errors.push('Product name is required');
    if (!this.price || this.price <= 0) errors.push('Valid product price is required');
    if (!this.images || this.images.length === 0) errors.push('At least one product image is required');
    if (!this.catalogId) errors.push('Product must be assigned to a catalog');
    if (!this.category || this.category === 'general') errors.push('Specific product category is required');
    
    if (errors.length > 0) {
        throw new Error(`Product cannot be submitted: ${errors.join(', ')}`);
    }
    
    this.status = 'submitted';
    this.rejectionReason = null;
    this.reviewedAt = null;
    this.superAdminNotes = null;
    
    return this.save();
};

// Method to approve product
productRequestSchema.methods.approve = function(superAdminId, notes = null) {
    this.status = 'approved';
    this.superAdminId = superAdminId;
    this.superAdminNotes = notes;
    this.reviewedAt = new Date();
    this.rejectionReason = null;
    
    return this.save();
};

// Method to reject product
productRequestSchema.methods.reject = function(superAdminId, reason, notes = null) {
    this.status = 'rejected';
    this.superAdminId = superAdminId;
    this.rejectionReason = reason;
    this.superAdminNotes = notes;
    this.reviewedAt = new Date();
    
    return this.save();
};

const ProductRequest = mongoose.model('ProductRequests', productRequestSchema);
module.exports = { ProductRequest };