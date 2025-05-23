// routes/productCatalogRoutes.js
const express = require('express');
const router = express.Router();
const ProductCatalogController = require('../controllers/productCatalogControllers');
const { adminAuth, superAdminAuth, adminOrSuperAdminAuth } = require('../middlewares/auth');

// Admin routes (requires admin authentication)
// Create a new product catalog
router.post('/', adminAuth, ProductCatalogController.createCatalog);

// Get all catalogs for an admin
router.get('/admin', adminAuth, ProductCatalogController.getAdminCatalogs);

// Set catalog as default
router.patch('/:id/set-default', adminAuth, ProductCatalogController.setDefaultCatalog);

// Delete a catalog
router.delete('/:id', adminAuth, ProductCatalogController.deleteCatalog);

// SuperAdmin routes (requires superadmin authentication)
// Get all catalogs for SuperAdmin
router.get('/superadmin', superAdminAuth, ProductCatalogController.getSuperAdminCatalogs);

// Common routes (both admin and superadmin can access)
// Get catalog by ID - this endpoint will check permissions inside the controller
router.get('/:id', (req, res, next) => {
    // First try admin auth, if it fails, try superadmin auth
    adminAuth(req, res, (err) => {
        if (err) {
            superAdminAuth(req, res, next);
        } else {
            next();
        }
    });
}, ProductCatalogController.getCatalog);

// Update catalog - this endpoint will check permissions inside the controller
router.patch('/:id', adminOrSuperAdminAuth, ProductCatalogController.updateCatalog);

module.exports = router;