// controllers/surepassControllers.js

const surepassServices = require('../services/surepassServices');

const handleJSONRequest = async (req, res, endpoint) => {
  try {
    const data = await surepassServices.postJSON(endpoint, req.body);
    res.status(200).json(data);
  } catch (err) {
    console.error(`Error in ${endpoint}:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: endpoint
    });
  }
};

const handleFormDataRequest = async (req, res, endpoint, fieldName) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File is required' });

    const data = await surepassServices.postFormData(endpoint, file.buffer, fieldName);
    res.status(200).json(data);
  } catch (err) {
    console.error(`Error in ${endpoint}:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: endpoint
    });
  }
};

// Generate Aadhaar OTP for verification
const generateAadhaarOTP = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Aadhaar number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.generateAadhaarOTP(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in aadhaar-otp-generate:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/aadhaar-v2/generate-otp' 
    });
  }
};

// Verify Aadhaar OTP 
const verifyAadhaarOTP = async (req, res) => {
  try {
    const { client_id, otp } = req.body;
    
    if (!client_id || !otp) {
      return res.status(400).json({ 
        error: 'Client ID and OTP are required' 
      });
    }
    
    const result = await surepassServices.verifyAadhaarOTP(client_id, otp);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in aadhaar-otp-verify:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/aadhaar-v2/submit-otp' 
    });
  }
};

// Verify bank account
const verifyBankAccount = async (req, res) => {
  try {
    const { id_number, ifsc, name, ifsc_details = true } = req.body;
    
    if (!id_number || !ifsc) {
      return res.status(400).json({ 
        error: 'Account number (id_number) and IFSC code are required' 
      });
    }
    
    const result = await surepassServices.verifyBankAccount(id_number, ifsc, name, ifsc_details);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in bank-account-verify:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/bank-verification/' 
    });
  }
};

// Get RC details by chassis number
const getChassisToRCDetails = async (req, res) => {
  try {
    const { chassis_number } = req.body;
    
    if (!chassis_number) {
      return res.status(400).json({ 
        error: 'Chassis number (chassis_number) is required' 
      });
    }
    
    const result = await surepassServices.getChassisToRCDetails(chassis_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in chassis-to-rc-details:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/rc/chassis-to-rc-details' 
    });
  }
};

// Get company details by CIN
const getCompanyDetails = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Company Identification Number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.getCompanyDetails(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in company-details:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/corporate/company-details' 
    });
  }
};

// Verify DIN (Director Identification Number)
const verifyDIN = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Director Identification Number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.verifyDIN(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in din-verification:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/corporate/din' 
    });
  }
};

// NEW: 1. Verify Driving License
const verifyDrivingLicense = async (req, res) => {
  try {
    const { id_number, dob } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Driving license number (id_number) is required' 
      });
    }
    
    if (!dob) {
      return res.status(400).json({ 
        error: 'Date of birth (dob) is required in YYYY-MM-DD format' 
      });
    }
    
    const result = await surepassServices.verifyDrivingLicense(id_number, dob);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in driving-license-verify:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/driving-license/driving-license' 
    });
  }
};

// NEW: 2. Get GSTIN Advanced Details
const getGSTINAdvanced = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'GSTIN number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.getGSTINAdvanced(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in gstin-advanced:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/corporate/gstin-advanced' 
    });
  }
};

// NEW: 3. Get GSTIN List by PAN
const getGSTINByPAN = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'PAN number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.getGSTINByPAN(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in gstin-by-pan:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/corporate/gstin-by-pan' 
    });
  }
};

// NEW: 4. Verify Udyog Aadhaar (UDYAM)
const verifyUdyogAadhaar = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Udyam registration number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.verifyUdyogAadhaar(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in udyog-aadhaar-verify:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/corporate/udyog-aadhaar' 
    });
  }
};

// NEW: 5. ITR Compliance Check
const checkITRCompliance = async (req, res) => {
  try {
    const { pan_number } = req.body;
    
    if (!pan_number) {
      return res.status(400).json({ 
        error: 'PAN number (pan_number) is required' 
      });
    }
    
    const result = await surepassServices.checkITRCompliance(pan_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in itr-compliance-check:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/itr/itr-compliance-check' 
    });
  }
};

// NEW: 6. Get RC Full Details
const getRCFullDetails = async (req, res) => {
  try {
    const { id_number } = req.body;
    
    if (!id_number) {
      return res.status(400).json({ 
        error: 'Vehicle registration number (id_number) is required' 
      });
    }
    
    const result = await surepassServices.getRCFullDetails(id_number);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error(`Error in rc-full-details:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: '/rc/rc-full' 
    });
  }
};

module.exports = {
  // Original endpoints
  emiratesIdOCR: (req, res) => handleFormDataRequest(req, res, '/api/ocr/emirates-id', 'file'),
  emiratesIdVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/emirates-id/verify'),
  uaeTradeLicense: (req, res) => handleFormDataRequest(req, res, '/api/v1/trade-license/verify', 'file'),
  uaeTrnOCR: (req, res) => handleFormDataRequest(req, res, '/api/ocr/trn', 'file'),
  uaeTrnVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/trn/verify'),
  uaeDlVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/uae-dl/verify'),
  uaeVehicleRC: (req, res) => handleJSONRequest(req, res, '/api/v1/uae-rc/verify'),
  qatarIdVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/qatar-id/verify'),
  bankAccountVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/bank-verification'),
  epfoPassbook: (req, res) => handleJSONRequest(req, res, '/api/v1/epfo-passbook'),
  form26AS: (req, res) => handleJSONRequest(req, res, '/api/v1/itr/form-26as'),
  incomeTaxReturn: (req, res) => handleJSONRequest(req, res, '/api/v1/itr/verify'),
  
  // Updated/added endpoints for KYC workflow
  panVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/pan/pan'),
  panComprehensive: (req, res) => handleJSONRequest(req, res, '/api/v1/pan/pan-comprehensive'),
  aadhaarToPan: (req, res) => handleJSONRequest(req, res, '/api/v1/pan/aadhaar-pan-link-check'),
  panValidation: (req, res) => handleJSONRequest(req, res, '/api/v1/pan/validate'),
  aadhaarVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/aadhaar-validation/aadhaar-validation'),
  voterIdVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/voter-id/verify'),
  voterIdOCR: (req, res) => handleFormDataRequest(req, res, '/api/ocr/voter-id', 'file'),
  dlVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/driving-license/driving-license'),
  passportVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/passport/passport/verify'),
  passportOCR: (req, res) => handleFormDataRequest(req, res, '/api/v1/passport/passport/:client_id/upload', 'file'),
  photoIdOCR: (req, res) => handleFormDataRequest(req, res, '/api/ocr/photo-id', 'file'),
  vehicleRCVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/rc/rc-full'),
  chassisToRC: (req, res) => handleJSONRequest(req, res, '/api/v1/rc/chassis-to-rc-details'),
  rcWithFinancer: (req, res) => handleJSONRequest(req, res, '/api/v1/rc/financer'),
  aadhaarMasking: (req, res) => handleFormDataRequest(req, res, '/api/v1/aadhaar-mask', 'file'),
  gstOtpVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/gst/otp'),
  gstVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/gst/verify'),
  gstToPhone: (req, res) => handleJSONRequest(req, res, '/api/v1/gst/details'),
  mcaData: (req, res) => handleJSONRequest(req, res, '/api/v1/mca/company'),
  mcaDocs: (req, res) => handleJSONRequest(req, res, '/api/v1/mca/filing'),
  tds206Compliance: (req, res) => handleJSONRequest(req, res, '/api/v1/tds-compliance'),
  fssaiVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/fssai/verify'),
  tanVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/tan/verify'),
  udyogVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/udyog/verify'),
  udyamVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/udyam/verify'),
  iecVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/iec/verify'),

  generateAadhaarOTP,
  verifyAadhaarOTP,
  verifyBankAccount,
  getChassisToRCDetails,
  getCompanyDetails,
  verifyDIN,
  verifyDrivingLicense,
  getGSTINAdvanced,
  getGSTINByPAN,
  verifyUdyogAadhaar,
  checkITRCompliance,
  getRCFullDetails
};