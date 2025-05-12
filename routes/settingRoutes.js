// routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');

// Get all settings for the current user (all roles)
router.get('/', adminOrAgentAuth, SettingsController.getAllSettings);

// Get settings by category (all roles)
router.get('/category/:category', adminOrAgentAuth, SettingsController.getSettingsByCategory);

// Get setting value by type and name (all roles)
router.get('/value/:type/:name', adminOrAgentAuth, SettingsController.getSettingValue);

// Get specific setting (all roles)
router.get('/:id', adminOrAgentAuth, SettingsController.getSetting);

// Create new setting (all roles, but with different permissions)
router.post('/', adminOrAgentAuth, SettingsController.createSetting);

// Update setting (all roles, but with different permissions)
router.put('/:id', adminOrAgentAuth, SettingsController.updateSetting);

// Bulk update settings (all roles, but with different permissions)
router.put('/bulk/update', adminOrAgentAuth, SettingsController.bulkUpdateSettings);

// Reset setting to default value (all roles, but with different permissions)
router.put('/:id/reset', adminOrAgentAuth, SettingsController.resetSetting);

// Delete setting (super admin only)
router.delete('/:id', superAdminAuth, SettingsController.deleteSetting);

// Additional routes for specific setting types

// System settings (super admin only)
router.get('/system/all', superAdminAuth, async (req, res, next) => {
    req.params.type = 'system';
    return SettingsController.getSettingsByCategory(req, res, next);
});

// Admin settings
router.get('/admin/:adminId', superAdminAuth, async (req, res, next) => {
    req.query.adminId = req.params.adminId;
    req.query.type = 'admin';
    return SettingsController.getAllSettings(req, res, next);
});

// Agent settings
router.get('/agent/:agentId', adminAuth, async (req, res, next) => {
    req.query.agentId = req.params.agentId;
    req.query.type = 'agent';
    return SettingsController.getAllSettings(req, res, next);
});

module.exports = router;