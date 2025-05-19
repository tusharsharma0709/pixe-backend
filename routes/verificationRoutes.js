// routes/verificationRoutes.js - Updated with Aadhaar OTP and Bank Verification

const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationControllers');
const surepassControllers = require('../controllers/surepassControllers');
const { userAuth } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

// Aadhaar OCR verification (file uploads)
router.post(
    '/aadhaar-ocr',
    userAuth,
    upload.fields([
        { name: 'aadhaarFront', maxCount: 1 },
        { name: 'aadhaarBack', maxCount: 1 }
    ]),
    verificationController.aadhaarOCR
);

// PAN card verification (file upload)
router.post(
    '/pan',
    userAuth,
    upload.single('panCard'),
    verificationController.panVerification
);

// Check Aadhaar-PAN link
router.post(
    '/aadhaar-pan-link',
    userAuth,
    verificationController.aadhaarPanLink
);

// Generate Aadhaar OTP for verification
router.post(
    '/aadhaar-otp/generate',
    userAuth,
    verificationController.generateAadhaarOTP
);

// Verify Aadhaar OTP 
router.post(
    '/aadhaar-otp/verify',
    userAuth,
    verificationController.verifyAadhaarOTP
);

// Bank account verification
router.post(
    '/bank-account',
    userAuth,
    verificationController.updateBankAccount
);

// Verify bank account using penny drop
router.post(
    '/bank-account/verify',
    userAuth,
    verificationController.verifyBankAccount
);

// Get verification status
router.get(
    '/status',
    userAuth,
    verificationController.getVerificationStatus
);

// Direct SurePass API endpoints for advanced use cases
// Aadhaar OTP endpoints
router.post('/aadhaar-v2/generate-otp',userAuth, surepassControllers.generateAadhaarOTP);
router.post('/aadhaar-v2/verify-otp',userAuth, surepassControllers.verifyAadhaarOTP);

// Bank verification endpoint
router.post('/bank-verification',userAuth, surepassControllers.verifyBankAccount);

// Other SurePass endpoints
router.post('/pan/verify',userAuth, surepassControllers.panVerification);
router.post('/pan/comprehensive',userAuth, surepassControllers.panComprehensive);
router.post('/pan/aadhaar-link',userAuth, surepassControllers.aadhaarToPan);
router.post('/aadhaar/verify',userAuth, surepassControllers.aadhaarVerification);

module.exports = router;