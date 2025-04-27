const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const { userAuth } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

// Defines the route for register and send otp
router.post('/register', userController.registerWithOtp);
// Defines the route for login and send otp
router.post('/login', userController.loginWithOtp);
// Defines the route to verify otp
router.post('/verify', userController.verifyOtp);
// Defines the route to update profile and select product
router.patch('/update',userAuth, userController.updateProfileAndProduct);
// Defines the route for Aadhaar OCR
router.post('/aadhaar-ocr',upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),userAuth, userController.aadhaarOCR);
// Defines the route for Pan OCR
router.post('/pan-ocr', upload.single('panDocument'),userAuth, userController.panOCR);
// Defines the route to check if Aadhaar linked to Pan
router.get('/verify-link',userAuth, userController.aadhaarPanLink);


module.exports = router;
