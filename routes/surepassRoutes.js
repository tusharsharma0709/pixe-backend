
// routes/surepassRoutes.js - Complete SurePass API Routes

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { adminAuth, agentAuth, userAuth } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validationMiddleware');
const { body, param } = require('express-validator');
const surepassControllers = require('../controllers/surepassControllers');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only image and PDF files are allowed'), false);
        }
    }
});

// Validation middleware for common parameters
const validateAadhaarNumber = body('id_number')
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Aadhaar number must be exactly 12 digits');

const validatePanNumber = body('id_number')
    .isLength({ min: 10, max: 10 })
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('PAN number must be in format AAAAA0000A');

const validateGstinNumber = body('id_number')
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be exactly 15 characters');

const validateDrivingLicense = [
    body('id_number')
        .isLength({ min: 10 })
        .withMessage('Driving license number must be at least 10 characters'),
    body('dob')
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage('Date of birth must be in YYYY-MM-DD format')
];

const validateBankAccount = [
    body('id_number')
        .isLength({ min: 8 })
        .isNumeric()
        .withMessage('Account number must be at least 8 digits'),
    body('ifsc')
        .isLength({ min: 11, max: 11 })
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .withMessage('IFSC code must be in format AAAA0NNNNNN')
];

const validateClientIdOtp = [
    body('client_id')
        .notEmpty()
        .withMessage('Client ID is required'),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be exactly 6 digits')
];

// =============================================================================
// AADHAAR VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/aadhaar/verify
 * @desc    Direct Aadhaar verification
 * @access  Private (Admin/Agent)
 */
router.post('/aadhaar/verify', 
    adminAuth, 
    validateAadhaarNumber,
    validateRequest,
    surepassControllers.aadhaarVerification
);

/**
 * @route   POST /api/surepass/aadhaar/generate-otp
 * @desc    Generate OTP for Aadhaar verification
 * @access  Private (Admin/Agent)
 */
router.post('/aadhaar/generate-otp', 
    adminAuth, 
    validateAadhaarNumber,
    validateRequest,
    surepassControllers.generateAadhaarOTP
);

/**
 * @route   POST /api/surepass/aadhaar/verify-otp
 * @desc    Verify Aadhaar OTP
 * @access  Private (Admin/Agent)
 */
router.post('/aadhaar/verify-otp', 
    adminAuth, 
    validateClientIdOtp,
    validateRequest,
    surepassControllers.verifyAadhaarOTP
);

/**
 * @route   POST /api/surepass/aadhaar/mask
 * @desc    Mask Aadhaar document
 * @access  Private (Admin/Agent)
 */
router.post('/aadhaar/mask', 
    adminAuth,
    upload.single('file'),
    surepassControllers.aadhaarMasking
);

// =============================================================================
// PAN VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/pan/verify
 * @desc    Verify PAN number
 * @access  Private (Admin/Agent)
 */
router.post('/pan/verify', 
    adminAuth, 
    validatePanNumber,
    validateRequest,
    surepassControllers.panVerification
);

/**
 * @route   POST /api/surepass/pan/comprehensive
 * @desc    Comprehensive PAN verification
 * @access  Private (Admin/Agent)
 */
router.post('/pan/comprehensive', 
    adminAuth, 
    validatePanNumber,
    validateRequest,
    surepassControllers.panComprehensive
);

/**
 * @route   POST /api/surepass/pan/validate
 * @desc    Validate PAN number format
 * @access  Private (Admin/Agent)
 */
router.post('/pan/validate', 
    adminAuth, 
    validatePanNumber,
    validateRequest,
    surepassControllers.panValidation
);

/**
 * @route   POST /api/surepass/pan/aadhaar-link
 * @desc    Check Aadhaar-PAN link
 * @access  Private (Admin/Agent)
 */
router.post('/pan/aadhaar-link', 
    adminAuth,
    [
        body('aadhaar_number')
            .isLength({ min: 12, max: 12 })
            .isNumeric()
            .withMessage('Aadhaar number must be exactly 12 digits'),
        body('pan_number')
            .isLength({ min: 10, max: 10 })
            .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
            .withMessage('PAN number must be in format AAAAA0000A')
    ],
    validateRequest,
    surepassControllers.aadhaarToPan
);

// =============================================================================
// DRIVING LICENSE VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/driving-license/verify
 * @desc    Verify driving license
 * @access  Private (Admin/Agent)
 */
router.post('/driving-license/verify', 
    adminAuth, 
    validateDrivingLicense,
    validateRequest,
    surepassControllers.verifyDrivingLicense
);

/**
 * @route   POST /api/surepass/driving-license
 * @desc    Verify driving license (alternative endpoint)
 * @access  Private (Admin/Agent)
 */
router.post('/driving-license', 
    adminAuth, 
    validateDrivingLicense,
    validateRequest,
    surepassControllers.verifyDrivingLicense
);

// =============================================================================
// BANK ACCOUNT VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/bank/verify
 * @desc    Verify bank account
 * @access  Private (Admin/Agent)
 */
router.post('/bank/verify', 
    adminAuth, 
    validateBankAccount,
    validateRequest,
    surepassControllers.verifyBankAccount
);

/**
 * @route   POST /api/surepass/bank-verification
 * @desc    Bank account verification (alternative endpoint)
 * @access  Private (Admin/Agent)
 */
router.post('/bank-verification', 
    adminAuth, 
    validateBankAccount,
    validateRequest,
    surepassControllers.bankAccountVerification
);

// =============================================================================
// GSTIN VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/gstin/verify
 * @desc    Basic GSTIN verification
 * @access  Private (Admin/Agent)
 */
router.post('/gstin/verify', 
    adminAuth, 
    validateGstinNumber,
    validateRequest,
    surepassControllers.gstVerification
);

/**
 * @route   POST /api/surepass/gstin/advanced
 * @desc    Advanced GSTIN details
 * @access  Private (Admin/Agent)
 */
router.post('/gstin/advanced', 
    adminAuth, 
    validateGstinNumber,
    validateRequest,
    surepassControllers.getGSTINAdvanced
);

/**
 * @route   POST /api/surepass/gstin/by-pan
 * @desc    Get GSTIN list by PAN
 * @access  Private (Admin/Agent)
 */
router.post('/gstin/by-pan', 
    adminAuth, 
    validatePanNumber,
    validateRequest,
    surepassControllers.getGSTINByPAN
);

/**
 * @route   POST /api/surepass/gstin/otp
 * @desc    GSTIN OTP verification
 * @access  Private (Admin/Agent)
 */
router.post('/gstin/otp', 
    adminAuth,
    body('id_number').notEmpty().withMessage('GSTIN is required'),
    validateRequest,
    surepassControllers.gstOtpVerification
);

/**
 * @route   POST /api/surepass/gstin/details
 * @desc    Get GSTIN to phone details
 * @access  Private (Admin/Agent)
 */
router.post('/gstin/details', 
    adminAuth,
    body('id_number').notEmpty().withMessage('GSTIN is required'),
    validateRequest,
    surepassControllers.gstToPhone
);

// =============================================================================
// VEHICLE RC VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/rc/verify
 * @desc    Basic RC verification
 * @access  Private (Admin/Agent)
 */
router.post('/rc/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('RC number is required'),
    validateRequest,
    surepassControllers.vehicleRCVerification
);

/**
 * @route   POST /api/surepass/rc/full-details
 * @desc    Get complete RC details
 * @access  Private (Admin/Agent)
 */
router.post('/rc/full-details', 
    adminAuth,
    body('id_number').notEmpty().withMessage('RC number is required'),
    validateRequest,
    surepassControllers.getRCFullDetails
);

/**
 * @route   POST /api/surepass/rc/chassis-to-rc
 * @desc    Get RC details by chassis number
 * @access  Private (Admin/Agent)
 */
router.post('/rc/chassis-to-rc', 
    adminAuth,
    body('chassis_number').notEmpty().withMessage('Chassis number is required'),
    validateRequest,
    surepassControllers.getChassisToRCDetails
);

/**
 * @route   POST /api/surepass/rc/financer
 * @desc    RC with financer details
 * @access  Private (Admin/Agent)
 */
router.post('/rc/financer', 
    adminAuth,
    body('id_number').notEmpty().withMessage('RC number is required'),
    validateRequest,
    surepassControllers.rcWithFinancer
);

// =============================================================================
// CORPORATE VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/corporate/company-details
 * @desc    Get company details by CIN
 * @access  Private (Admin/Agent)
 */
router.post('/corporate/company-details', 
    adminAuth,
    body('id_number').notEmpty().withMessage('CIN is required'),
    validateRequest,
    surepassControllers.getCompanyDetails
);

/**
 * @route   POST /api/surepass/corporate/din
 * @desc    Verify Director Identification Number
 * @access  Private (Admin/Agent)
 */
router.post('/corporate/din', 
    adminAuth,
    body('id_number')
        .isLength({ min: 8, max: 8 })
        .isNumeric()
        .withMessage('DIN must be exactly 8 digits'),
    validateRequest,
    surepassControllers.verifyDIN
);

/**
 * @route   POST /api/surepass/corporate/udyog-aadhaar
 * @desc    Verify Udyog Aadhaar (UDYAM)
 * @access  Private (Admin/Agent)
 */
router.post('/corporate/udyog-aadhaar', 
    adminAuth,
    body('id_number')
        .matches(/^UDYAM-/)
        .withMessage('Udyam number must start with UDYAM-'),
    validateRequest,
    surepassControllers.verifyUdyogAadhaar
);

/**
 * @route   POST /api/surepass/corporate/mca/company
 * @desc    MCA company data
 * @access  Private (Admin/Agent)
 */
router.post('/corporate/mca/company', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Company identifier is required'),
    validateRequest,
    surepassControllers.mcaData
);

/**
 * @route   POST /api/surepass/corporate/mca/filing
 * @desc    MCA filing documents
 * @access  Private (Admin/Agent)
 */
router.post('/corporate/mca/filing', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Company identifier is required'),
    validateRequest,
    surepassControllers.mcaDocs
);

// =============================================================================
// ITR & TAX VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/itr/compliance-check
 * @desc    Check ITR compliance
 * @access  Private (Admin/Agent)
 */
router.post('/itr/compliance-check', 
    adminAuth, 
    validatePanNumber,
    validateRequest,
    surepassControllers.checkITRCompliance
);

/**
 * @route   POST /api/surepass/itr/verify
 * @desc    Income tax return verification
 * @access  Private (Admin/Agent)
 */
router.post('/itr/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('PAN is required'),
    validateRequest,
    surepassControllers.incomeTaxReturn
);

/**
 * @route   POST /api/surepass/itr/form-26as
 * @desc    Form 26AS verification
 * @access  Private (Admin/Agent)
 */
router.post('/itr/form-26as', 
    adminAuth,
    body('id_number').notEmpty().withMessage('PAN is required'),
    validateRequest,
    surepassControllers.form26AS
);

/**
 * @route   POST /api/surepass/tan/verify
 * @desc    TAN verification
 * @access  Private (Admin/Agent)
 */
router.post('/tan/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('TAN is required'),
    validateRequest,
    surepassControllers.tanVerification
);

/**
 * @route   POST /api/surepass/tds/compliance
 * @desc    TDS compliance check
 * @access  Private (Admin/Agent)
 */
router.post('/tds/compliance', 
    adminAuth,
    body('id_number').notEmpty().withMessage('PAN is required'),
    validateRequest,
    surepassControllers.tds206Compliance
);

// =============================================================================
// OTHER VERIFICATION ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/voter-id/verify
 * @desc    Voter ID verification
 * @access  Private (Admin/Agent)
 */
router.post('/voter-id/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Voter ID is required'),
    validateRequest,
    surepassControllers.voterIdVerification
);

/**
 * @route   POST /api/surepass/voter-id/ocr
 * @desc    Voter ID OCR
 * @access  Private (Admin/Agent)
 */
router.post('/voter-id/ocr', 
    adminAuth,
    upload.single('file'),
    surepassControllers.voterIdOCR
);

/**
 * @route   POST /api/surepass/passport/verify
 * @desc    Passport verification
 * @access  Private (Admin/Agent)
 */
router.post('/passport/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Passport number is required'),
    validateRequest,
    surepassControllers.passportVerification
);

/**
 * @route   POST /api/surepass/passport/ocr
 * @desc    Passport OCR
 * @access  Private (Admin/Agent)
 */
router.post('/passport/ocr', 
    adminAuth,
    upload.single('file'),
    surepassControllers.passportOCR
);

/**
 * @route   POST /api/surepass/fssai/verify
 * @desc    FSSAI license verification
 * @access  Private (Admin/Agent)
 */
router.post('/fssai/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('FSSAI license number is required'),
    validateRequest,
    surepassControllers.fssaiVerification
);

/**
 * @route   POST /api/surepass/udyog/verify
 * @desc    Udyog registration verification
 * @access  Private (Admin/Agent)
 */
router.post('/udyog/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Udyog registration number is required'),
    validateRequest,
    surepassControllers.udyogVerification
);

/**
 * @route   POST /api/surepass/udyam/verify
 * @desc    Udyam registration verification
 * @access  Private (Admin/Agent)
 */
router.post('/udyam/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Udyam registration number is required'),
    validateRequest,
    surepassControllers.udyamVerification
);

/**
 * @route   POST /api/surepass/iec/verify
 * @desc    IEC verification
 * @access  Private (Admin/Agent)
 */
router.post('/iec/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('IEC code is required'),
    validateRequest,
    surepassControllers.iecVerification
);

/**
 * @route   POST /api/surepass/epfo/passbook
 * @desc    EPFO passbook verification
 * @access  Private (Admin/Agent)
 */
router.post('/epfo/passbook', 
    adminAuth,
    body('id_number').notEmpty().withMessage('UAN/PF number is required'),
    validateRequest,
    surepassControllers.epfoPassbook
);

// =============================================================================
// OCR ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/ocr/photo-id
 * @desc    Photo ID OCR
 * @access  Private (Admin/Agent)
 */
router.post('/ocr/photo-id', 
    adminAuth,
    upload.single('file'),
    surepassControllers.photoIdOCR
);

// =============================================================================
// UAE SPECIFIC ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/uae/emirates-id/verify
 * @desc    UAE Emirates ID verification
 * @access  Private (Admin/Agent)
 */
router.post('/uae/emirates-id/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Emirates ID is required'),
    validateRequest,
    surepassControllers.emiratesIdVerification
);

/**
 * @route   POST /api/surepass/uae/emirates-id/ocr
 * @desc    UAE Emirates ID OCR
 * @access  Private (Admin/Agent)
 */
router.post('/uae/emirates-id/ocr', 
    adminAuth,
    upload.single('file'),
    surepassControllers.emiratesIdOCR
);

/**
 * @route   POST /api/surepass/uae/trade-license
 * @desc    UAE Trade License verification
 * @access  Private (Admin/Agent)
 */
router.post('/uae/trade-license', 
    adminAuth,
    upload.single('file'),
    surepassControllers.uaeTradeLicense
);

/**
 * @route   POST /api/surepass/uae/trn/verify
 * @desc    UAE TRN verification
 * @access  Private (Admin/Agent)
 */
router.post('/uae/trn/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('TRN is required'),
    validateRequest,
    surepassControllers.uaeTrnVerification
);

/**
 * @route   POST /api/surepass/uae/trn/ocr
 * @desc    UAE TRN OCR
 * @access  Private (Admin/Agent)
 */
router.post('/uae/trn/ocr', 
    adminAuth,
    upload.single('file'),
    surepassControllers.uaeTrnOCR
);

/**
 * @route   POST /api/surepass/uae/driving-license/verify
 * @desc    UAE Driving License verification
 * @access  Private (Admin/Agent)
 */
router.post('/uae/driving-license/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('UAE DL number is required'),
    validateRequest,
    surepassControllers.uaeDlVerification
);

/**
 * @route   POST /api/surepass/uae/vehicle-rc
 * @desc    UAE Vehicle RC verification
 * @access  Private (Admin/Agent)
 */
router.post('/uae/vehicle-rc', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Vehicle registration is required'),
    validateRequest,
    surepassControllers.uaeVehicleRC
);

// =============================================================================
// QATAR SPECIFIC ROUTES
// =============================================================================

/**
 * @route   POST /api/surepass/qatar/id/verify
 * @desc    Qatar ID verification
 * @access  Private (Admin/Agent)
 */
router.post('/qatar/id/verify', 
    adminAuth,
    body('id_number').notEmpty().withMessage('Qatar ID is required'),
    validateRequest,
    surepassControllers.qatarIdVerification
);

module.exports = router;