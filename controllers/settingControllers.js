// controllers/SettingsController.js
const { Settings } = require('../models/Settings');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const mongoose = require('mongoose');

const SettingsController = {
    // Get all settings for the current user
    getAllSettings: async (req, res) => {
        try {
            const { userType, userId } = req;
            
            let query = {};
            
            if (userType === 'superadmin') {
                // Super admin can see all settings
                query.type = { $in: ['system', 'superadmin'] };
                query.superAdminId = userId;
            } else if (userType === 'admin') {
                // Admin can see their own settings
                query.type = { $in: ['admin', 'whatsapp', 'facebook', 'workflow', 'notification', 'payment'] };
                query.adminId = userId;
            } else if (userType === 'agent') {
                // Agent can see their own settings
                query.type = 'agent';
                query.agentId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user type'
                });
            }
            
            const settings = await Settings.find(query).sort({ category: 1, name: 1 });
            
            return res.status(200).json({
                success: true,
                data: {
                    settings
                }
            });
        } catch (error) {
            console.error("Error in getAllSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get settings by category
    getSettingsByCategory: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { category } = req.params;
            
            let query = { category };
            
            if (userType === 'superadmin') {
                query.type = { $in: ['system', 'superadmin'] };
                query.superAdminId = userId;
            } else if (userType === 'admin') {
                query.type = { $in: ['admin', 'whatsapp', 'facebook', 'workflow', 'notification', 'payment'] };
                query.adminId = userId;
            } else if (userType === 'agent') {
                query.type = 'agent';
                query.agentId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user type'
                });
            }
            
            const settings = await Settings.find(query).sort({ name: 1 });
            
            return res.status(200).json({
                success: true,
                data: {
                    settings
                }
            });
        } catch (error) {
            console.error("Error in getSettingsByCategory:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get specific setting
    getSetting: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const setting = await Settings.findById(id);
            
            if (!setting) {
                return res.status(404).json({
                    success: false,
                    message: 'Setting not found'
                });
            }
            
            // Check permission
            if (userType === 'superadmin' && setting.superAdminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this setting'
                });
            } else if (userType === 'admin' && setting.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this setting'
                });
            } else if (userType === 'agent' && setting.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this setting'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    setting
                }
            });
        } catch (error) {
            console.error("Error in getSetting:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get setting value by name
    getSettingValue: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { type, name } = req.params;
            
            let context = {};
            if (userType === 'superadmin') {
                context.superAdminId = userId;
            } else if (userType === 'admin') {
                context.adminId = userId;
            } else if (userType === 'agent') {
                context.agentId = userId;
            }
            
            const value = await Settings.getSettingValue(type, name, context);
            
            return res.status(200).json({
                success: true,
                data: {
                    value
                }
            });
        } catch (error) {
            console.error("Error in getSettingValue:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Create new setting
    createSetting: async (req, res) => {
        try {
            const { userType, userId } = req;
            const settingData = req.body;
            
            // Check permission
            if (userType === 'superadmin') {
                settingData.superAdminId = userId;
                settingData.lastUpdatedBy = { id: userId, role: 'superadmin' };
            } else if (userType === 'admin') {
                // Admin can only create certain types of settings
                if (!['admin', 'whatsapp', 'facebook', 'workflow', 'notification', 'payment'].includes(settingData.type)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Not authorized to create this type of setting'
                    });
                }
                settingData.adminId = userId;
                settingData.lastUpdatedBy = { id: userId, role: 'admin' };
            } else if (userType === 'agent') {
                // Agent can only create agent settings
                if (settingData.type !== 'agent') {
                    return res.status(403).json({
                        success: false,
                        message: 'Not authorized to create this type of setting'
                    });
                }
                settingData.agentId = userId;
                settingData.lastUpdatedBy = { id: userId, role: 'agent' };
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user type'
                });
            }
            
            const setting = await Settings.create(settingData);
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : 'Agents',
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: setting._id,
                description: `Created new setting: ${setting.name}`,
                status: 'success'
            });
            
            return res.status(201).json({
                success: true,
                data: {
                    setting
                }
            });
        } catch (error) {
            console.error("Error in createSetting:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Update setting
    updateSetting: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const updateData = req.body;
            
            const setting = await Settings.findById(id);
            
            if (!setting) {
                return res.status(404).json({
                    success: false,
                    message: 'Setting not found'
                });
            }
            
            // Check permission
            if (userType === 'superadmin' && setting.superAdminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this setting'
                });
            } else if (userType === 'admin' && setting.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this setting'
                });
            } else if (userType === 'agent' && setting.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this setting'
                });
            }
            
            // Check if setting is editable
            if (!setting.isEditable) {
                return res.status(403).json({
                    success: false,
                    message: 'This setting is not editable'
                });
            }
            
            // Track changed fields
            const changedFields = [];
            if (updateData.value !== undefined && updateData.value !== setting.value) {
                changedFields.push({
                    field: 'value',
                    oldValue: setting.value,
                    newValue: updateData.value
                });
            }
            
            // Update lastUpdatedBy
            updateData.lastUpdatedBy = { 
                id: userId, 
                role: userType === 'superadmin' ? 'superadmin' : userType === 'admin' ? 'admin' : 'agent' 
            };
            
            // Update setting
            Object.assign(setting, updateData);
            
            // Validate setting if validation rules exist
            if (setting.validationRules && !setting.validateValue()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid setting value based on validation rules'
                });
            }
            
            await setting.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : 'Agents',
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: setting._id,
                description: `Updated setting: ${setting.name}`,
                changedFields,
                status: 'success'
            });
            
            // Create notification for significant settings changes
            if (setting.type === 'system' || setting.type === 'payment' || setting.type === 'verification') {
                await Notification.create({
                    type: 'system',
                    title: 'Setting Updated',
                    description: `Important setting "${setting.displayName || setting.name}" has been updated`,
                    forSuperAdmin: true,
                    relatedTo: {
                        model: 'Settings',
                        id: setting._id
                    },
                    priority: 'high'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    setting
                }
            });
        } catch (error) {
            console.error("Error in updateSetting:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Bulk update settings
    bulkUpdateSettings: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { settings } = req.body; // Array of settings to update
            
            if (!Array.isArray(settings)) {
                return res.status(400).json({
                    success: false,
                    message: 'Settings must be an array'
                });
            }
            
            const updatedSettings = [];
            const errors = [];
            
            for (const settingUpdate of settings) {
                try {
                    const setting = await Settings.findById(settingUpdate.id);
                    
                    if (!setting) {
                        errors.push({ id: settingUpdate.id, error: 'Setting not found' });
                        continue;
                    }
                    
                    // Check permission
                    if (userType === 'superadmin' && setting.superAdminId?.toString() !== userId) {
                        errors.push({ id: settingUpdate.id, error: 'Not authorized' });
                        continue;
                    } else if (userType === 'admin' && setting.adminId?.toString() !== userId) {
                        errors.push({ id: settingUpdate.id, error: 'Not authorized' });
                        continue;
                    } else if (userType === 'agent' && setting.agentId?.toString() !== userId) {
                        errors.push({ id: settingUpdate.id, error: 'Not authorized' });
                        continue;
                    }
                    
                    if (!setting.isEditable) {
                        errors.push({ id: settingUpdate.id, error: 'Setting is not editable' });
                        continue;
                    }
                    
                    // Update setting
                    setting.value = settingUpdate.value;
                    setting.lastUpdatedBy = { 
                        id: userId, 
                        role: userType === 'superadmin' ? 'superadmin' : userType === 'admin' ? 'admin' : 'agent' 
                    };
                    
                    // Validate setting
                    if (setting.validationRules && !setting.validateValue()) {
                        errors.push({ id: settingUpdate.id, error: 'Invalid value based on validation rules' });
                        continue;
                    }
                    
                    await setting.save();
                    updatedSettings.push(setting);
                    
                } catch (error) {
                    errors.push({ id: settingUpdate.id, error: error.message });
                }
            }
            
            // Log bulk update activity
            if (updatedSettings.length > 0) {
                await ActivityLog.create({
                    actorId: userId,
                    actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : 'Agents',
                    action: 'settings_updated',
                    entityType: 'Settings',
                    description: `Bulk updated ${updatedSettings.length} settings`,
                    status: 'success',
                    metadata: { updatedSettings: updatedSettings.map(s => s._id) }
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    updatedSettings,
                    errors
                }
            });
        } catch (error) {
            console.error("Error in bulkUpdateSettings:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Reset setting to default value
    resetSetting: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const setting = await Settings.findById(id);
            
            if (!setting) {
                return res.status(404).json({
                    success: false,
                    message: 'Setting not found'
                });
            }
            
            // Check permission
            if (userType === 'superadmin' && setting.superAdminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to reset this setting'
                });
            } else if (userType === 'admin' && setting.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to reset this setting'
                });
            } else if (userType === 'agent' && setting.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to reset this setting'
                });
            }
            
            if (setting.defaultValue === null || setting.defaultValue === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'No default value available for this setting'
                });
            }
            
            const oldValue = setting.value;
            setting.value = setting.defaultValue;
            setting.lastUpdatedBy = { 
                id: userId, 
                role: userType === 'superadmin' ? 'superadmin' : userType === 'admin' ? 'admin' : 'agent' 
            };
            
            await setting.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : 'Agents',
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: setting._id,
                description: `Reset setting to default: ${setting.name}`,
                changedFields: [{
                    field: 'value',
                    oldValue: oldValue,
                    newValue: setting.defaultValue
                }],
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    setting
                }
            });
        } catch (error) {
            console.error("Error in resetSetting:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Delete setting (only for custom settings)
    deleteSetting: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const setting = await Settings.findById(id);
            
            if (!setting) {
                return res.status(404).json({
                    success: false,
                    message: 'Setting not found'
                });
            }
            
            // Only super admin can delete settings
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can delete settings'
                });
            }
            
            // Only allow deletion of custom settings
            if (setting.category !== 'custom') {
                return res.status(403).json({
                    success: false,
                    message: 'Only custom settings can be deleted'
                });
            }
            
            await setting.deleteOne();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'SuperAdmins',
                action: 'settings_updated',
                entityType: 'Settings',
                entityId: setting._id,
                description: `Deleted setting: ${setting.name}`,
                status: 'success'
            });
            
            return res.status(204).json({
                success: true,
                data: null
            });
        } catch (error) {
            console.error("Error in deleteSetting:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = SettingsController;