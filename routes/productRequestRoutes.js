// routes/productRequestRoutes.js
const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/auth');
const upload = require('../middlewares/multer');
const productRequestController = require('../controllers/productRequestControllers');

// Admin routes
router.post(
    '/', 
    adminAuth, 
    upload.uploadMultiple, // Allow up to 10 product images
    productRequestController.createProductRequest
);

router.get(
    '/admin',
    adminAuth,
    productRequestController.getAdminProductRequests
);

router.get(
    '/admin/:id',
    adminAuth,
    productRequestController.getProductRequestById
);

router.put(
    '/:id',
    adminAuth,
    upload.uploadMultiple,
    productRequestController.updateProductRequest
);

router.delete(
    '/:id',
    adminAuth,
    productRequestController.deleteProductRequest
);

// Super Admin routes
router.get(
    '/',
    superAdminAuth,
    productRequestController.getAllProductRequests
);

router.get(
    '/:id',
    superAdminAuth,
    productRequestController.getSuperAdminProductRequestById
);

router.patch(
    '/:id/review',
    superAdminAuth,
    productRequestController.reviewProductRequest
);

router.post(
    '/:id/publish',
    superAdminAuth,
    productRequestController.publishProduct
);

module.exports = router;