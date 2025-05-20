// models/Workflows.js
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
            'message',
            'input',
            'condition',
            'api',
            'surepass',
            'bank_verification',
            'interactive',
            'credit_check',
            'loan_offer',
            'payment_link',
            'document_generate',
            'tally_integration',
            'gst_billing',
            'shipment',
            'make_webhook',
            'video_kyc',
            'end'
        ],
        required: true
    },
    content: {
        type: String
    },
    // Updated options schema to support both text/value and text/nextNodeId patterns
    options: [{
        text: String,
        value: String,  // Added this field
        nextNodeId: String  // Kept existing field
    }],
    // For API nodes
    apiEndpoint: {
        type: String
    },
    apiMethod: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE']
    },
    apiParams: {
        type: mongoose.Schema.Types.Mixed
    },
    // For SurePass API nodes
    surepassApiType: {
        type: String,
        enum: [
            'aadhaar-ocr', 
            'pan-ocr', 
            'aadhaar-otp', 
            'aadhaar-verify', 
            'pan-verify',
            'video-kyc'
        ]
    },
    // For banking verification nodes
    bankVerificationType: {
        type: String,
        enum: ['penny-drop', 'bank-statement', 'ifsc-check']
    },
    // For credit check nodes
    creditBureau: {
        type: String,
        enum: ['cibil', 'experian', 'equifax']
    },
    // For document generation nodes
    documentType: {
        type: String,
        enum: ['invoice', 'agreement', 'welcome_letter', 'receipt']
    },
    // For integration nodes
    integrationUrl: {
        type: String
    },
    webhookUrl: {
        type: String
    },
    // Tracking variables
    variableName: {
        type: String // Name of the variable to store input
    },
    // Next node
    nextNodeId: {
        type: String
    },
    // Conditional routing
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
}, { 
    _id: false,
    strict: false  // Allow extra fields not defined in the schema
});

const workflowSchema = new mongoose.Schema({
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
        type: String
    }],
    category: {
        type: String,
        default: 'general'
    }
}, { 
    timestamps: true 
});

// Add indexes for faster queries
workflowSchema.index({ adminId: 1, isActive: 1 });
workflowSchema.index({ isTemplate: 1, category: 1 });

const Workflow = mongoose.model('Workflows', workflowSchema);
module.exports = { Workflow };