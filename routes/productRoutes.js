const express = require('express');
const router = express.Router();
const product = require('../controllers/productControllers');
const { adminAuth, userAuth } = require('../middlewares/auth');

// Create Product
router.post('/add', adminAuth, product.createProduct);
// Get All Products
router.get('/get', adminAuth, product.getAllProducts);
// Get All Products
router.get('/user/get', userAuth, product.getAllProducts);
// Get Single Product
router.get('/get/:id', adminAuth, product.getProductById);
// Get Single Product
router.get('/user/get/:id', userAuth, product.getProductById);
// Update Product
router.patch('/update/:id', adminAuth, product.updateProduct);
// Delete Product
router.delete('/delete/:id', adminAuth, product.deleteProduct);

module.exports = router;
