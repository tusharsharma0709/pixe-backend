// routes/surepassRoutes.js
const express = require('express');
const router = express.Router();
const surepassController = require('../controllers/surepassControllers');
const { userAuth } = require('../middlewares/auth');
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
router.post('/pan-verification', 
    userAuth, 
    surepassController.panVerification
);

/**
 * @route   POST /api/v1/pan/aadhaar-pan-link-check
 * @desc    Check if Aadhaar and PAN are linked
 * @access  Private
 */
router.post('/aadhaar-pan-link-check', 
    userAuth, 
    surepassController.aadhaarToPan
);

/**
 * @route   POST /api/ocr/aadhaar
 * @desc    Process OCR for Aadhaar card
 * @access  Private
 */
router.post('/ocr/aadhaar', 
    userAuth, 
    upload.single('file'), 
    surepassController.aadhaarOCR
);

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
    (req, res) => {
        const { id_number } = req.body;
        if (!id_number) {
            return res.status(400).json({ error: 'Aadhaar number is required' });
        }
        
        // Forward the request to SurePass
        surepassController.aadhaarVerification(req, res);
    }
);

/**
 * @route   POST /api/v1/aadhaar-v2/submit-otp
 * @desc    Submit OTP for Aadhaar verification
 * @access  Private
 */
router.post('/aadhaar-v2/submit-otp', 
    userAuth, 
    (req, res) => {
        const { client_id, otp } = req.body;
        if (!client_id || !otp) {
            return res.status(400).json({ error: 'Client ID and OTP are required' });
        }
        
        // Forward the request to SurePass
        surepassController.aadhaarVerification(req, res);
    }
);

/**
 * @route   POST /api/v1/bank-verification
 * @desc    Verify bank account
 * @access  Private
 */
router.post('/bank-verification', 
    userAuth, 
    surepassController.bankAccountVerification
);

module.exports = router;