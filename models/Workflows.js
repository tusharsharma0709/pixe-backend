// models/Workflow.js
const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
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
    nodes: [{
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
                'message',                 // Simple message node
                'input',                   // Input collection node
                'condition',               // Conditional logic node
                'api',                     // External API call node
                'surepass',                // SurePass API integration node
                'bank_verification',       // Bank account verification node
                'credit_check',            // Credit bureau check node
                'loan_offer',              // Loan offer display node
                'payment_link',            // Payment link generation node
                'document_generate',       // Document generation node
                'tally_integration',       // Tally integration node
                'gst_billing',             // GST billing node
                'shipment',                // Shipment tracking node
                'make_webhook',            // Make.com webhook node
                'video_kyc'                // Video KYC node
            ],
            required: true
        },
        content: {
            type: String
        },
        options: [{
            text: String,
            nextNodeId: String
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
    }]
}, { timestamps: true });

const Workflow = mongoose.model('Workflows', workflowSchema);
module.exports = { Workflow };