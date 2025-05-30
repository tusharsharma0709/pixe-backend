// models/Workflows.js - Complete updated model based on workflowControllers.js
const mongoose = require('mongoose');

const workflowNodeSchema = new mongoose.Schema({
    nodeId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'start',
            'end',
            'message',
            'input',
            'output',
            'condition',
            'action',
            'api',              // Used extensively in controller for SurePass
            'interactive',      // Referenced in controller validation
            'surepass',
            'bank_verification',
            'credit_check',
            'loan_offer',
            'payment_link',
            'document_generate',
            'tally_integration',
            'gst_billing',
            'shipment',
            'make_webhook',
            'video_kyc',
            'webhook',
            'notification',
            'email',
            'sms',
            'call',
            'transfer',
            'collect_input',
            'play_audio',
            'record_audio',
            'branch',
            'loop',
            'variable_set',
            'variable_get',
            'calculation',
            'validation',
            'custom'
        ],
        required: true
    },
    content: {
        type: String
    },
    // Updated options schema to support both text/value and text/nextNodeId patterns
    options: [{
        text: String,
        value: String,
        nextNodeId: String
    }],
    // For API nodes - Enhanced for SurePass integration
    apiEndpoint: {
        type: String,
        // Validate SurePass endpoints based on controller SUREPASS_ENDPOINTS
        validate: {
            validator: function(v) {
                if (this.type !== 'api') return true;
                const validEndpoints = [
                    '/api/verification/aadhaar-v2/generate-otp',
                    '/api/verification/aadhaar-v2/submit-otp',
                    '/api/verification/pan',
                    '/api/verification/aadhaar-pan-link',
                    '/api/verification/bank-verification',
                    '/api/verification/chassis-to-rc-details',
                    '/api/verification/company-details',
                    '/api/verification/din-verification',
                    '/api/verification/fssai',
                    '/api/verification/gstin',
                    '/api/verification/icai'
                ];
                return !v || validEndpoints.includes(v);
            },
            message: 'Invalid API endpoint for SurePass integration'
        }
    },
    apiMethod: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'POST'
    },
    apiParams: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    apiHeaders: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // SurePass-specific configuration - Added based on controller processing
    surePassConfig: {
        endpointName: String,
        description: String,
        isKycVerification: {
            type: Boolean,
            default: false
        },
        verificationStep: String,
        requiredParams: [String]
    },
    // For SurePass API nodes - Enhanced enum
    surepassApiType: {
        type: String,
        enum: [
            'aadhaar-ocr',
            'pan-ocr',
            'aadhaar-otp',
            'aadhaar-verify',
            'pan-verify',
            'video-kyc',
            'chassis-to-rc',      // Added based on controller
            'company-details',    // Added based on controller
            'din-verification',   // Added based on controller
            'fssai',             // Added based on controller
            'gstin',             // Added based on controller
            'icai'               // Added based on controller
        ]
    },
    // For banking verification nodes
    bankVerificationType: {
        type: String,
        enum: ['penny-drop', 'bank-statement', 'ifsc-check', 'account-verification']
    },
    // For credit check nodes
    creditBureau: {
        type: String,
        enum: ['cibil', 'experian', 'equifax', 'crif']
    },
    // For document generation nodes
    documentType: {
        type: String,
        enum: ['invoice', 'agreement', 'welcome_letter', 'receipt', 'kyc_report', 'verification_certificate']
    },
    // For integration nodes
    integrationUrl: {
        type: String
    },
    webhookUrl: {
        type: String
    },
    // Tracking variables - Enhanced based on controller validation
    variableName: {
        type: String // Name of the variable to store input
    },
    // Next node
    nextNodeId: {
        type: String
    },
    // Conditional routing - Enhanced for controller condition validation
    condition: {
        type: String // e.g., "creditScore > 700"
    },
    trueNodeId: {
        type: String // Node to go to if condition is true
    },
    falseNodeId: {
        type: String // Node to go to if condition is false
    },
    // Error handling
    errorNodeId: {
        type: String // Node to go to if there's an error
    },
    // Keep support for buttons array
    buttons: [{
        text: String,
        value: String
    }],
    // Node positioning for visual workflow builder
    position: {
        x: {
            type: Number,
            default: 0
        },
        y: {
            type: Number,
            default: 0
        }
    },
    // Node metadata for additional configuration
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { 
    _id: false,
    strict: false  // Allow extra fields not defined in the schema
});

const workflowSchema = new mongoose.Schema({
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
    isActive: {
        type: Boolean,
        default: true
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    nodes: [workflowNodeSchema],
    startNodeId: {
        type: String,
        required: true
    },
    version: {
        type: Number,
        default: 1
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    // Enhanced category enum to match controller usage
    category: {
        type: String,
        enum: [
            'general',
            'kyc',           // Used in controller for KYC workflows
            'sales',         // Used in controller templates
            'finance',       // Used in controller templates
            'verification',
            'onboarding',
            'customer_service',
            'lead_generation',
            'property',      // For property sales workflows
            'banking',
            'insurance',
            'ecommerce',
            'healthcare',
            'education',
            'government',
            'telecom',
            'utilities',
            'custom'
        ],
        default: 'general'
    },
    // Add workflow status to track different states
    status: {
        type: String,
        enum: [
            'draft',
            'active',
            'inactive',
            'paused',
            'testing',
            'archived',
            'error',
            'under_review'
        ],
        default: 'draft'
    },
    // Enhanced metadata to support SurePass integration tracking
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        // SurePass integration tracking
        hasSurePassIntegration: {
            type: Boolean,
            default: false
        },
        surePassEndpoints: [{
            type: String
        }],
        totalNodes: {
            type: Number,
            default: 0
        },
        surePassNodeCount: {
            type: Number,
            default: 0
        },
        lastTestedAt: Date,
        testResults: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    // Add version control for workflow updates
    versionHistory: [{
        version: Number,
        changes: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admins'
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        snapshot: {
            type: mongoose.Schema.Types.Mixed // Store complete workflow snapshot
        }
    }],
    // Add analytics and usage tracking
    analytics: {
        totalExecutions: {
            type: Number,
            default: 0
        },
        successfulExecutions: {
            type: Number,
            default: 0
        },
        failedExecutions: {
            type: Number,
            default: 0
        },
        averageExecutionTime: {
            type: Number,
            default: 0
        },
        lastExecutedAt: Date,
        lastAnalyticsUpdate: Date
    },
    // Add template and cloning support
    templateId: {
        type: String,
        sparse: true,
        unique: true
    },
    clonedFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflows',
        default: null
    },
    cloneCount: {
        type: Number,
        default: 0
    },
    // Add execution settings
    executionSettings: {
        timeout: {
            type: Number,
            default: 300000 // 5 minutes in milliseconds
        },
        retryAttempts: {
            type: Number,
            default: 3
        },
        enableLogging: {
            type: Boolean,
            default: true
        }
    },
    // Soft delete support
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, { 
    timestamps: true,
    collection: 'workflows'
});

// Enhanced indexes for better query performance
workflowSchema.index({ adminId: 1, isActive: 1 });
workflowSchema.index({ isTemplate: 1, category: 1 });
workflowSchema.index({ 'metadata.hasSurePassIntegration': 1 });
workflowSchema.index({ category: 1, isActive: 1 });
workflowSchema.index({ templateId: 1 });
workflowSchema.index({ clonedFrom: 1 });
workflowSchema.index({ status: 1 });
workflowSchema.index({ 'analytics.totalExecutions': -1 });
workflowSchema.index({ isDeleted: 1, status: 1 });

// Virtual for SurePass integration summary
workflowSchema.virtual('surePassSummary').get(function() {
    return {
        hasIntegration: this.metadata?.hasSurePassIntegration || false,
        endpointCount: this.metadata?.surePassNodeCount || 0,
        endpoints: this.metadata?.surePassEndpoints || []
    };
});

// Pre-save middleware to update metadata
workflowSchema.pre('save', function(next) {
    // Update node counts and SurePass integration status
    if (this.nodes && this.nodes.length > 0) {
        this.metadata.totalNodes = this.nodes.length;
        
        const surePassNodes = this.nodes.filter(node => 
            node.type === 'api' && 
            node.apiEndpoint && 
            (node.apiEndpoint.includes('verification') || node.apiEndpoint.includes('surepass'))
        );
        
        this.metadata.surePassNodeCount = surePassNodes.length;
        this.metadata.hasSurePassIntegration = surePassNodes.length > 0;
        this.metadata.surePassEndpoints = surePassNodes.map(n => n.apiEndpoint);
    }
    
    next();
});

// Static methods referenced in controller
workflowSchema.statics.findByTemplate = function(templateId) {
    return this.find({ templateId: templateId, isDeleted: false });
};

workflowSchema.statics.findWithSurePassIntegration = function(adminId = null) {
    const query = { 
        'metadata.hasSurePassIntegration': true,
        isDeleted: false
    };
    if (adminId) query.adminId = adminId;
    return this.find(query);
};

workflowSchema.statics.getActiveWorkflows = function(adminId = null) {
    const query = { 
        isActive: true,
        status: 'active',
        isDeleted: false
    };
    if (adminId) query.adminId = adminId;
    return this.find(query);
};

// Instance methods for workflow management
workflowSchema.methods.clone = async function(newName, adminId) {
    const cloned = new this.constructor({
        name: newName || `${this.name} (Copy)`,
        description: this.description,
        category: this.category,
        tags: [...this.tags],
        nodes: this.nodes.map(node => ({ ...node.toObject() })),
        startNodeId: this.startNodeId,
        adminId: adminId || this.adminId,
        isActive: false, // Start cloned workflows as inactive
        metadata: { ...this.metadata },
        clonedFrom: this._id
    });
    
    // Increment clone count on original
    this.cloneCount = (this.cloneCount || 0) + 1;
    await this.save();
    
    return await cloned.save();
};

workflowSchema.methods.activate = function() {
    this.isActive = true;
    this.status = 'active';
    return this.save();
};

workflowSchema.methods.deactivate = function() {
    this.isActive = false;
    this.status = 'inactive';
    return this.save();
};

workflowSchema.methods.updateAnalytics = function(executionData) {
    if (!this.analytics) this.analytics = {};
    
    this.analytics.totalExecutions = (this.analytics.totalExecutions || 0) + 1;
    
    if (executionData.success) {
        this.analytics.successfulExecutions = (this.analytics.successfulExecutions || 0) + 1;
    } else {
        this.analytics.failedExecutions = (this.analytics.failedExecutions || 0) + 1;
    }
    
    if (executionData.duration) {
        const currentAvg = this.analytics.averageExecutionTime || 0;
        const totalExec = this.analytics.totalExecutions;
        this.analytics.averageExecutionTime = ((currentAvg * (totalExec - 1)) + executionData.duration) / totalExec;
    }
    
    this.analytics.lastExecutedAt = new Date();
    this.analytics.lastAnalyticsUpdate = new Date();
    
    return this.save();
};

const Workflow = mongoose.model('Workflows', workflowSchema);
module.exports = { Workflow };