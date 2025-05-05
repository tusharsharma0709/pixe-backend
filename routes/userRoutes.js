  // 3. ROUTES
  // routes/userRoutes.js
  const express = require('express');
  const router = express.Router();
  const userController = require('../controllers/userControllers');
  const { userAuth } = require('../middlewares/auth');
  const upload = require('../middlewares/multer');
  
  // Authentication routes
  router.post('/register', userController.registerWithOtp);
  router.post('/login', userController.loginWithOtp);
  router.post('/verify-otp', userController.verifyOtp);
  
  // Profile management
  router.get('/profile', userAuth, userController.getUserProfile);
  router.patch('/update-profile', userAuth, userController.updateProfileAndProduct);
  router.get('/workflow-status', userAuth, userController.getUserWorkflowStatus);
  
  // KYC verification routes
  router.post('/aadhaar-ocr', 
    userAuth, 
    upload.fields([
      { name: 'aadhaarFront', maxCount: 1 },
      { name: 'aadhaarBack', maxCount: 1 }
    ]), 
    userController.aadhaarOCR
  );
  
  router.post('/pan-ocr', 
    userAuth, 
    upload.single('panDocument'), 
    userController.panOCR
  );
  
  router.get('/verify-aadhaar-pan-link', userAuth, userController.aadhaarPanLink);
  
  // Aadhaar OTP verification
  router.post('/aadhaar-generate-otp', userAuth, userController.generateAadhaarOTP);
  router.post('/aadhaar-verify-otp', userAuth, userController.verifyAadhaarOTP);
  
  // Banking verification
  router.post('/bank-account', userAuth, userController.updateBankAccount);
  router.post('/verify-bank-account', userAuth, userController.verifyBankAccount);
  
  module.exports = router;
