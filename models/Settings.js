// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['system', 'admin', 'agent', 'superadmin', 'whatsapp', 'facebook', 'workflow', 'notification', 'payment', 'verification', 'report'],
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        default: null
    },
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmins',
        default: null
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agents',
        default: null
    },
    name: {
        type: String,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    defaultValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    dataType: {
        type: String,
        enum: ['string', 'number', 'boolean', 'array', 'object', 'date'],
        required: true
    },
    description: {
        type: String,
        default: null
    },
    isEditable: {
        type: Boolean,
        default: true
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        default: 'general'
    },
    displayName: {
        type: String,
        default: function() {
            return this.name;
        }
    },
    validationRules: {
        type: Object,
        default: null
    },
    options: [{
        label: String,
        value: mongoose.Schema.Types.Mixed
    }],
    lastUpdatedBy: {
        id: {
            type: mongoose.Schema.Types.ObjectId
        },
        role: {
            type: String,
            enum: ['superadmin', 'admin', 'agent', 'system']
        }
    },
    metadata: {
        type: Object,
        default: null
    }
}, {
    timestamps: true
});

// Add compound unique index for settings
settingsSchema.index(
    { 
        type: 1, 
        name: 1, 
        adminId: 1, 
        superAdminId: 1, 
        agentId: 1 
    }, 
    { 
        unique: true,
        // Handle null or undefined values in the unique index
        partialFilterExpression: {
            $and: [
                { type: { $exists: true } },
                { name: { $exists: true } }
            ]
        }
    }
);

// Add indexes for faster queries
settingsSchema.index({ type: 1, category: 1 });
settingsSchema.index({ adminId: 1, type: 1 });
settingsSchema.index({ superAdminId: 1, type: 1 });
settingsSchema.index({ agentId: 1, type: 1 });

// Static method to retrieve settings with fallback to default
settingsSchema.statics.getSettingValue = async function(
    type, 
    name, 
    { 
        adminId = null, 
        superAdminId = null, 
        agentId = null 
    } = {}
) {
    // First try to find specific setting
    const query = { type, name };
    
    if (adminId) query.adminId = adminId;
    if (superAdminId) query.superAdminId = superAdminId;
    if (agentId) query.agentId = agentId;
    
    const setting = await this.findOne(query);
    
    if (setting) return setting.value;
    
    // If not found with specific ID, try to find global setting
    const globalQuery = { 
        type, 
        name,
        adminId: null,
        superAdminId: null,
        agentId: null
    };
    
    const globalSetting = await this.findOne(globalQuery);
    
    if (globalSetting) return globalSetting.value;
    
    // If still not found, return null
    return null;
};

// Instance method to validate setting value based on rules
// Changed from 'validate' to 'validateValue' to avoid conflict with Mongoose's internal method
settingsSchema.methods.validateValue = function() {
    const rules = this.validationRules;
    const value = this.value;
    
    if (!rules) return true; // No rules to validate
    
    // Simple validation based on dataType
    if (this.dataType === 'string' && typeof value !== 'string') return false;
    if (this.dataType === 'number' && typeof value !== 'number') return false;
    if (this.dataType === 'boolean' && typeof value !== 'boolean') return false;
    if (this.dataType === 'array' && !Array.isArray(value)) return false;
    if (this.dataType === 'object' && (typeof value !== 'object' || Array.isArray(value))) return false;
    
    // Additional validations from rules
    if (rules.min !== undefined && value < rules.min) return false;
    if (rules.max !== undefined && value > rules.max) return false;
    if (rules.pattern && this.dataType === 'string' && !new RegExp(rules.pattern).test(value)) return false;
    if (rules.enum && !rules.enum.includes(value)) return false;
    
    return true;
};

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = { Settings };