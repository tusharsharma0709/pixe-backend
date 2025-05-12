// models/WhatsappTemplates.js
const mongoose = require('mongoose');

const whatsappComponentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['header', 'body', 'footer', 'button'],
        required: true
    },
    format: {
        type: String,
        enum: ['text', 'image', 'document', 'video', 'location'],
        default: 'text'
    },
    text: {
        type: String,
        default: null
    },
    example: {
        type: Object,
        default: null
    },
    buttons: [{
        type: {
            type: String,
            enum: ['quick_reply', 'url', 'phone_number', 'copy_code'],
            required: true
        },
        text: {
            type: String,
            required: true
        },
        url: {
            type: String,
            default: null
        },
        phone_number: {
            type: String,
            default: null
        }
    }],
    parameters: [{
        type: {
            type: String,
            enum: ['text', 'currency', 'date_time', 'image', 'document', 'video'],
            default: 'text'
        },
        text: {
            type: String,
            default: null
        },
        currency: {
            code: String,
            amount: Number
        },
        date_time: {
            type: Object,
            default: null
        },
        image: {
            link: String
        },
        document: {
            link: String,
            filename: String
        },
        video: {
            link: String
        }
    }]
}, { _id: false });

const whatsappTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    category: {
        type: String,
        enum: ['marketing', 'utility', 'authentication', 'alert', 'service_update', 'payment_update', 'personal', 'other'],
        required: true
    },
    language: {
        type: String,
        default: 'en_US'
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'rejected', 'disabled'],
        default: 'draft'
    },
    rejectionReason: {
        type: String,
        default: null
    },
    facebookTemplateId: {
        type: String,
        default: null
    },
    components: [whatsappComponentSchema],
    metadata: {
        type: Object,
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
    },
    example: {
        type: String,
        default: null // Example of the template with variables filled
    },
    variables: [{
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: null
        },
        componentType: {
            type: String,
            enum: ['header', 'body', 'footer', 'button'],
            required: true
        },
        required: {
            type: Boolean,
            default: true
        },
        exampleValue: {
            type: String,
            default: null
        }
    }],
    tags: [{
        type: String
    }],
    approvalInfo: {
        submittedAt: {
            type: Date,
            default: null
        },
        approvedAt: {
            type: Date,
            default: null
        },
        rejectedAt: {
            type: Date,
            default: null
        },
        facebookResponse: {
            type: Object,
            default: null
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Add indexes for faster queries
whatsappTemplateSchema.index({ adminId: 1, status: 1 });
whatsappTemplateSchema.index({ name: 1, adminId: 1 });
whatsappTemplateSchema.index({ category: 1, status: 1 });
whatsappTemplateSchema.index({ reviewedBy: 1, status: 1 });
whatsappTemplateSchema.index({ isActive: 1, category: 1 });

const WhatsappTemplate = mongoose.model('WhatsappTemplates', whatsappTemplateSchema);
module.exports = { WhatsappTemplate };