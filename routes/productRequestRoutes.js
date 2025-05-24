// routes/productRequestRoutes.js
const express = require('express');
const router = express.Router();
const { adminAuth, superAdminAuth } = require('../middlewares/auth');
const userTypeMiddleware = require('../middlewares/userTypeMiddlewares');
const multer = require('../middlewares/multer');
const productRequestController = require('../controllers/productRequestControllers');

// Configure multer for product image uploads
const productImagesUpload = multer.array('files', 10); // Allow up to 10 files

// Admin routes for product requests
router.post(
    '/', 
    adminAuth, 
    userTypeMiddleware, // Add this middleware for consistency
    productImagesUpload,
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
    userTypeMiddleware,
    productImagesUpload,
    productRequestController.updateProductRequest
);

router.delete(
    '/:id',
    adminAuth,
    productRequestController.deleteProductRequest
);

router.patch(
    '/:id/apply',
    adminAuth,
    productRequestController.reviewApplyProduct
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