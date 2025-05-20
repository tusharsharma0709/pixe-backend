// models/Workflows.js
const mongoose = require('mongoose');

// Suggested update for models/Workflows.js
// Focus on the workflowNodeSchema section

const workflowSchema = new mongoose.Schema({
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
            'interactive', // Interactive node type
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
    // Define options as an explicit array of objects with proper schema
    options: [{
        text: { type: String },
        value: { type: String }
    }],
    // Also support buttons format for backward compatibility
    buttons: [{
        text: { type: String },
        value: { type: String }
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
    }
}, { _id: false }
, { 
    timestamps: true 
});

// Add indexes for faster queries
workflowSchema.index({ adminId: 1, isActive: 1 });
workflowSchema.index({ isTemplate: 1, category: 1 });

const Workflow = mongoose.model('Workflows', workflowSchema);
module.exports = { Workflow };