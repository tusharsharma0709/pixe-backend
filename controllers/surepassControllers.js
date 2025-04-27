const { postJSON, postFormData } = require('../services/surepassServices');

const handleJSONRequest = async (req, res, endpoint) => {
  try {
    const data = await postJSON(endpoint, req.body);
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

    const data = await postFormData(endpoint, file.buffer, fieldName);
    res.status(200).json(data);
  } catch (err) {
    console.error(`Error in ${endpoint}:`, err.message || err);
    res.status(500).json({ 
      error: err.message || 'An error occurred during the API request',
      endpoint: endpoint
    });
  }
};

module.exports = {
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
  iecVerification: (req, res) => handleJSONRequest(req, res, '/api/v1/iec/verify')
};
