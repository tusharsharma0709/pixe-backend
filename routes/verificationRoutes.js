// routes/verificationRoutes.js - Updated routes for KYC workflow

const express = require('express');
const router = express.Router();
const { userAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');
const verificationController = require('../controllers/verificationControllers');
const upload = require('../middlewares/multer');

// Check if a user is already verified
router.get('/status', userAuth, verificationController.getVerificationStatus);

// Aadhaar OCR verification routes
router.post('/aadhaar-ocr', 
    userAuth, 
    upload.fields([
        { name: 'aadhaarFront', maxCount: 1 },
        { name: 'aadhaarBack', maxCount: 1 }
    ]),
    verificationController.aadhaarOCR
);

// PAN verification route
router.post('/pan', 
    userAuth, 
    upload.single('file'),
    verificationController.panVerification
);

// Aadhaar-PAN link check route
router.post('/aadhaar-pan-link', userAuth, verificationController.aadhaarPanLink);

// Aadhaar OTP verification routes
router.post('/generate-aadhaar-otp', userAuth, verificationController.generateAadhaarOTP);
router.post('/verify-aadhaar-otp', userAuth, verificationController.verifyAadhaarOTP);

// Bank account verification routes
router.post('/update-bank-account', userAuth, verificationController.updateBankAccount);
router.post('/verify-bank-account', userAuth, verificationController.verifyBankAccount);

// Special routes for workflow integration
// router.post('/workflow/process-aadhaar', userAuth, verificationController.processWorkflowAadhaar);
// router.post('/workflow/process-pan', userAuth, verificationController.processWorkflowPan);
// router.post('/workflow/check-link', userAuth, verificationController.checkWorkflowAadhaarPanLink);

module.exports = router;