// models/ProductCatalogs.js - Updated with comprehensive enum values
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    currencyCode: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'],
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
        min: 0,
        max: 100,
        default: 0
    },
    taxIncluded: {
        type: Boolean,
        default: false
    },
    weightUnit: {
        type: String,
        enum: ['g', 'kg', 'lb', 'oz'],
        default: 'kg'
    },
    dimensionUnit: {
        type: String,
        enum: ['cm', 'in', 'm'],
        default: 'cm'
    },
    autoPublish: {
        type: Boolean,
        default: false
    },
    requireApproval: {
        type: Boolean,
        default: true
    },
    allowBackorders: {
        type: Boolean,
        default: false
    },
    trackInventory: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const integrationsSchema = new mongoose.Schema({
    facebookPage: {
        pageId: String,
        pageName: String,
        accessToken: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    },
    instagramAccount: {
        accountId: String,
        username: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    },
    whatsappBusinessAccount: {
        accountId: String,
        phoneNumber: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    },
    googleMerchant: {
        merchantId: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    },
    shopify: {
        storeUrl: String,
        apiKey: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    },
    woocommerce: {
        storeUrl: String,
        consumerKey: String,
        consumerSecret: String,
        connected: {
            type: Boolean,
            default: false
        },
        lastSyncAt: Date
    }
}, { _id: false });

const productCatalogSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true,
        index: true
    },
    facebookCatalogId: {
        type: String,
        default: null,
        unique: true,
        sparse: true
    },
    facebookCatalogUrl: {
        type: String,
        default: null,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Facebook catalog URL must be a valid HTTP/HTTPS URL'
        }
    },
    status: {
        type: String,
        enum: [
            'draft', 
            'pending', 
            'active', 
            'inactive', 
            'rejected',
            'suspended',
            'archived',
            'under_review',
            'needs_revision',
            'expired'
        ],
        default: 'draft',
        index: true
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
    isDefault: {
        type: Boolean,
        default: false,
        index: true
    },
    category: {
        type: String,
        enum: [
            'general',
            'fashion',
            'electronics',
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
            'custom'
        ],
        default: 'general'
    },
    subCategory: {
        type: String,
        trim: true,
        maxlength: 100
    },
    productCount: {
        type: Number,
        default: 0,
        min: 0
    },
    approvedProductCount: {
        type: Number,
        default: 0,
        min: 0
    },
    pendingProductCount: {
        type: Number,
        default: 0,
        min: 0
    },
    settings: {
        type: settingsSchema,
        default: () => ({})
    },
    integrations: {
        type: integrationsSchema,
        default: () => ({})
    },
    rejectionReason: {
        type: String,
        maxlength: 500,
        default: null
    },
    // Business information
    businessType: {
        type: String,
        enum: [
            'retail',
            'wholesale',
            'manufacturing',
            'dropshipping',
            'marketplace',
            'service_provider',
            'digital_products',
            'subscription',
            'other'
        ],
        default: 'retail'
    },
    targetMarkets: [{
        type: String,
        enum: [
            'local',
            'national',
            'international',
            'B2B',
            'B2C',
            'B2B2C'
        ]
    }],
    // Compliance and certifications
    compliance: {
        gdprCompliant: {
            type: Boolean,
            default: false
        },
        isoCertified: {
            type: Boolean,
            default: false
        },
        organicCertified: {
            type: Boolean,
            default: false
        },
        fssaiApproved: {
            type: Boolean,
            default: false
        },
        customCertifications: [String]
    },
    // Performance metrics
    metrics: {
        totalViews: {
            type: Number,
            default: 0
        },
        totalOrders: {
            type: Number,
            default: 0
        },
        totalRevenue: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        lastSyncedAt: Date
    },
    // Sync and automation
    syncSettings: {
        autoSync: {
            type: Boolean,
            default: false
        },
        syncFrequency: {
            type: String,
            enum: ['hourly', 'daily', 'weekly', 'manual'],
            default: 'daily'
        },
        lastSyncAt: Date,
        nextSyncAt: Date,
        syncErrors: [{
            error: String,
            timestamp: Date,
            resolved: {
                type: Boolean,
                default: false
            }
        }]
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
            unique: true,
            sparse: true
        }
    },
    // Image and branding
    branding: {
        logoUrl: {
            type: String,
            validate: {
                validator: function(v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: 'Logo URL must be a valid HTTP/HTTPS URL'
            }
        },
        bannerUrl: {
            type: String,
            validate: {
                validator: function(v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: 'Banner URL must be a valid HTTP/HTTPS URL'
            }
        },
        brandColors: {
            primary: String,
            secondary: String,
            accent: String
        },
        brandFonts: {
            primary: String,
            secondary: String
        }
    },
    // Analytics and tracking
    analytics: {
        googleAnalyticsId: String,
        facebookPixelId: String,
        customTrackingCodes: [String],
        enableTracking: {
            type: Boolean,
            default: true
        }
    },
    // Workflow and approval
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    approvalWorkflow: {
        requireSuperAdminApproval: {
            type: Boolean,
            default: true
        },
        requireComplianceCheck: {
            type: Boolean,
            default: false
        },
        autoApprovalRules: [{
            condition: String,
            action: String
        }]
    },
    // Version control
    version: {
        type: Number,
        default: 1
    },
    versionHistory: [{
        version: Number,
        changes: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'versionHistory.changedByModel'
        },
        changedByModel: {
            type: String,
            enum: ['Admins', 'SuperAdmins']
        },
        changedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Tags and labels
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    labels: [{
        name: {
            type: String,
            required: true
        },
        color: {
            type: String,
            default: '#007bff'
        }
    }],
    // Notes and comments
    adminNotes: {
        type: String,
        maxlength: 1000
    },
    internalNotes: {
        type: String,
        maxlength: 1000
    },
    // Expiry and scheduling
    expiresAt: {
        type: Date,
        default: null
    },
    scheduledPublishAt: {
        type: Date,
        default: null
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
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
    collection: 'product_catalogs'
});

// Indexes for better query performance
productCatalogSchema.index({ adminId: 1, status: 1 });
productCatalogSchema.index({ facebookCatalogId: 1 });
productCatalogSchema.index({ superAdminId: 1, createdAt: -1 });
productCatalogSchema.index({ status: 1, createdAt: -1 });
productCatalogSchema.index({ category: 1, status: 1 });
productCatalogSchema.index({ businessType: 1 });
productCatalogSchema.index({ isDefault: 1, adminId: 1 });
productCatalogSchema.index({ 'seo.slug': 1 });
productCatalogSchema.index({ isDeleted: 1, status: 1 });
productCatalogSchema.index({ expiresAt: 1 });
productCatalogSchema.index({ lastActivityAt: -1 });

// Virtual for total integration count
productCatalogSchema.virtual('totalIntegrations').get(function() {
    if (!this.integrations) return 0;
    
    let count = 0;
    Object.keys(this.integrations).forEach(key => {
        if (this.integrations[key] && this.integrations[key].connected) {
            count++;
        }
    });
    return count;
});

// Virtual for completion percentage
productCatalogSchema.virtual('completionPercentage').get(function() {
    let completed = 0;
    let total = 8; // Total required fields for completion
    
    if (this.name) completed++;
    if (this.description) completed++;
    if (this.category && this.category !== 'general') completed++;
    if (this.businessType && this.businessType !== 'retail') completed++;
    if (this.branding && this.branding.logoUrl) completed++;
    if (this.settings && this.settings.currencyCode) completed++;
    if (this.seo && this.seo.metaDescription) completed++;
    if (this.totalIntegrations > 0) completed++;
    
    return Math.round((completed / total) * 100);
});

// Pre-save middleware
productCatalogSchema.pre('save', function(next) {
    // Update last activity timestamp
    this.lastActivityAt = new Date();
    
    // Generate slug if not provided
    if (!this.seo.slug && this.name) {
        this.seo.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    // Ensure only one default catalog per admin
    if (this.isDefault && this.isModified('isDefault')) {
        this.constructor.updateMany(
            { adminId: this.adminId, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        ).exec();
    }
    
    next();
});

// Static method to get catalogs by status
productCatalogSchema.statics.getByStatus = function(status, adminId = null) {
    const query = { status, isDeleted: false };
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name email_id')
        .populate('superAdminId', 'first_name last_name')
        .sort({ createdAt: -1 });
};

// Static method to get catalogs needing attention
productCatalogSchema.statics.getCatalogsNeedingAttention = function(adminId = null) {
    const query = {
        isDeleted: false,
        $or: [
            { status: 'pending' },
            { status: 'needs_revision' },
            { 'syncSettings.syncErrors.resolved': false },
            { productCount: 0 },
            { expiresAt: { $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } // Expiring in 7 days
        ]
    };
    
    if (adminId) query.adminId = adminId;
    
    return this.find(query)
        .populate('adminId', 'first_name last_name business_name')
        .sort({ createdAt: -1 });
};

// Method to update product counts
productCatalogSchema.methods.updateProductCounts = async function() {
    const Product = mongoose.model('Products');
    const ProductRequest = mongoose.model('ProductRequests');
    
    try {
        // Get actual product counts
        const [totalProducts, approvedProducts, pendingProducts] = await Promise.all([
            Product.countDocuments({ catalogId: this._id }),
            Product.countDocuments({ catalogId: this._id, status: 'active' }),
            ProductRequest.countDocuments({ catalogId: this._id, status: { $in: ['submitted', 'under_review'] } })
        ]);
        
        this.productCount = totalProducts;
        this.approvedProductCount = approvedProducts;
        this.pendingProductCount = pendingProducts;
        
        return this.save();
    } catch (error) {
        console.error('Error updating product counts:', error);
        return this;
    }
};

// Method to add sync error
productCatalogSchema.methods.addSyncError = function(error) {
    if (!this.syncSettings.syncErrors) {
        this.syncSettings.syncErrors = [];
    }
    
    this.syncSettings.syncErrors.push({
        error: error.toString(),
        timestamp: new Date(),
        resolved: false
    });
    
    // Keep only last 10 errors
    if (this.syncSettings.syncErrors.length > 10) {
        this.syncSettings.syncErrors = this.syncSettings.syncErrors.slice(-10);
    }
    
    return this.save();
};

// Method to resolve sync errors
productCatalogSchema.methods.resolveSyncErrors = function() {
    if (this.syncSettings.syncErrors) {
        this.syncSettings.syncErrors.forEach(error => {
            error.resolved = true;
        });
    }
    
    return this.save();
};

const ProductCatalog = mongoose.model('ProductCatalogs', productCatalogSchema);
module.exports = { ProductCatalog };