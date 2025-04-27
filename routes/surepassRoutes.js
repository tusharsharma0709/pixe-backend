const express = require('express');
const router = express.Router();
const controller = require('../controllers/surepassControllers');
const upload = require('../middlewares/multer');

// Example: POST /api/surepass/emirates-id-ocr
router.post('/emirates-id-ocr', upload.single('file'), controller.emiratesIdOCR);
router.post('/emirates-id-verify', controller.emiratesIdVerification);
router.post('/trade-license', upload.single('file'), controller.uaeTradeLicense);
router.post('/trn-ocr', upload.single('file'), controller.uaeTrnOCR);
router.post('/trn-verify', controller.uaeTrnVerification);
router.post('/uae-dl-verify', controller.uaeDlVerification);
router.post('/uae-rc-verify', controller.uaeVehicleRC);
router.post('/qatar-id-verify', controller.qatarIdVerification);
router.post('/bank-account', controller.bankAccountVerification);//checked
router.post('/epfo-passbook', controller.epfoPassbook);
router.post('/form-26as', controller.form26AS);
router.post('/itr', controller.incomeTaxReturn);
router.post('/pan-verify', controller.panVerification);//checked
router.post('/pan-advance', controller.panComprehensive);//checked
router.post('/aadhaar-to-pan', controller.aadhaarToPan);//checked
router.post('/pan-validation', controller.panValidation);
router.post('/aadhaar-verification', controller.aadhaarVerification);//checked
router.post('/voter-id-verify', controller.voterIdVerification);
router.post('/voter-id-ocr', upload.single('file'), controller.voterIdOCR);
router.post('/dl-verification', controller.dlVerification);//checked
router.post('/passport-verification', controller.passportVerification);
router.post('/passport-ocr', upload.single('file'), controller.passportOCR);
router.post('/photo-id-ocr', upload.single('file'), controller.photoIdOCR);
router.post('/rc-verification', controller.vehicleRCVerification);//checked
router.post('/chassis-to-rc', controller.chassisToRC);//checked
router.post('/rc-financer', controller.rcWithFinancer);
router.post('/aadhaar-mask', upload.single('file'), controller.aadhaarMasking);
router.post('/gst-otp', controller.gstOtpVerification);
router.post('/gst-verify', controller.gstVerification);
router.post('/gst-details', controller.gstToPhone);
router.post('/mca-company', controller.mcaData);
router.post('/mca-filing', controller.mcaDocs);
router.post('/tds-compliance', controller.tds206Compliance);
router.post('/fssai-verify', controller.fssaiVerification);
router.post('/tan-verify', controller.tanVerification);
router.post('/udyog-verify', controller.udyogVerification);
router.post('/udyam-verification', controller.udyamVerification);
router.post('/iec-verify', controller.iecVerification);

module.exports = router;
