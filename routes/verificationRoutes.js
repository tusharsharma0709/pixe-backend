// routes/verificationRoutes.js
const express = require('express');
const router = express.Router();
const { userAuth } = require('../middlewares/auth');
const upload = require('../middlewares/multer'); // Import the upload module correctly
const verificationController = require('../controllers/verificationControllers');

// User verification routes
router.post(
    '/aadhaar-ocr', 
    userAuth, 
    upload.fields([
        { name: 'aadhaarFront', maxCount: 1 },
        { name: 'aadhaarBack', maxCount: 1 }
    ]),
    verificationController.aadhaarOCR
);

router.post(
    '/pan-verification', 
    userAuth, 
    upload.single('pan'),
    verificationController.panVerification
);

router.post(
    '/aadhaar-pan-link', 
    userAuth, 
    verificationController.aadhaarPanLink
);

router.post(
    '/generate-aadhaar-otp', 
    userAuth, 
    verificationController.generateAadhaarOTP
);

router.post(
    '/verify-aadhaar-otp', 
    userAuth, 
    verificationController.verifyAadhaarOTP
);

router.post(
    '/update-bank-account', 
    userAuth, 
    verificationController.updateBankAccount
);

router.post(
    '/verify-bank-account', 
    userAuth, 
    verificationController.verifyBankAccount
);

router.get(
    '/status', 
    userAuth, 
    verificationController.getVerificationStatus
);

module.exports = router;