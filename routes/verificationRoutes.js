// routes/surepassRoutes.js - Updated with new endpoints
const express = require('express');
const router = express.Router();
const surepassController = require('../controllers/surepassControllers');
const { userAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

/**
 * @route   POST /api/v1/aadhaar-validation/aadhaar-validation
 * @desc    Validate Aadhaar by ID number
 * @access  Private
 */
router.post('/aadhaar-validation', 
    userAuth, 
    surepassController.aadhaarVerification
);

/**
 * @route   POST /api/v1/pan/pan
 * @desc    Validate PAN card
 * @access  Private
 */
router.post('/pan', 
    userAuth, 
    surepassController.panVerification
);

/**
 * @route   POST /api/v1/pan/aadhaar-pan-link-check
 * @desc    Check if Aadhaar and PAN are linked
 * @access  Private
 */
router.post('/aadhaar-pan-link', 
    userAuth, 
    surepassController.aadhaarToPan
);

/**
 * @route   POST /api/ocr/aadhaar
 * @desc    Process OCR for Aadhaar card
 * @access  Private
 */
// router.post('/ocr/aadhaar', 
//     userAuth, 
//     upload.single('file'), 
//     surepassController.aadhaarOCR
// );

/**
 * @route   POST /api/ocr/pan
 * @desc    Process OCR for PAN card
 * @access  Private
 */
router.post('/ocr/pan', 
    userAuth, 
    upload.single('file'), 
    surepassController.voterIdOCR
);

/**
 * @route   POST /api/v1/aadhaar-v2/generate-otp
 * @desc    Generate OTP for Aadhaar verification
 * @access  Private
 */
router.post('/aadhaar-v2/generate-otp', 
    userAuth, 
    surepassController.generateAadhaarOTP
);

/**
 * @route   POST /api/v1/aadhaar-v2/submit-otp
 * @desc    Submit OTP for Aadhaar verification
 * @access  Private
 */
router.post('/aadhaar-v2/submit-otp', 
    userAuth, 
    surepassController.verifyAadhaarOTP
);

/**
 * @route   POST /api/v1/bank-verification
 * @desc    Verify bank account
 * @access  Private
 */
router.post('/bank-verification', 
    userAuth, 
    surepassController.verifyBankAccount
);

/**
 * @route   POST /api/v1/rc/chassis-to-rc-details
 * @desc    Get RC details by chassis number
 * @access  Private
 */
router.post('/chassis-to-rc-details', 
    userAuth, 
    surepassController.getChassisToRCDetails
);

/**
 * @route   POST /api/v1/corporate/company-details
 * @desc    Get company details by CIN
 * @access  Private
 */
router.post('/company-details', 
    userAuth, 
    surepassController.getCompanyDetails
);

/**
 * @route   POST /api/v1/corporate/din
 * @desc    Verify Director Identification Number (DIN)
 * @access  Private
 */
router.post('/din-verification', 
    userAuth, 
    surepassController.verifyDIN
);

module.exports = router;