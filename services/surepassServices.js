// services/surepassServices.js

const axios = require('axios');
const FormData = require('form-data');

/**
 * SurePass API base URL
 */
const SUREPASS_BASE_URL = process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io/api/v1';

/**
 * SurePass API key
 */
const SUREPASS_API_KEY = process.env.SUREPASS_API_KEY;

/**
 * Make a JSON POST request to SurePass API
 * @param {String} endpoint - API endpoint path
 * @param {Object} data - Request payload
 * @returns {Promise} - API response
 */
const postJSON = async (endpoint, data) => {
    try {
        const url = `${SUREPASS_BASE_URL}${endpoint}`;
        console.log(`Making SurePass API request to: ${url}`);
        console.log(`Request payload:`, JSON.stringify(data, null, 2));
        
        if (!SUREPASS_API_KEY) {
            console.error('SUREPASS_API_KEY is not set in environment');
            throw new Error('API key not configured');
        }
        
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000 // 20-second timeout
        });
        
        console.log(`SurePass API response status: ${response.status}`);
        console.log(`SurePass API response:`, JSON.stringify(response.data, null, 2));
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('SurePass API error:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
            console.error(`Headers:`, error.response.headers);
        } else if (error.request) {
            console.error(`No response received:`, error.request);
        } else {
            console.error(`Error setting up request:`, error.message);
        }
        
        return {
            success: false,
            error: error.response?.data?.error || error.message,
            statusCode: error.response?.status
        };
    }
};

/**
 * Make a form data POST request to SurePass API (for file uploads)
 * @param {String} endpoint - API endpoint path
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {String} fieldName - Form field name 
 * @returns {Promise} - API response
 */
const postFormData = async (endpoint, fileBuffer, fieldName = 'file') => {
    try {
        const url = `${SUREPASS_BASE_URL}${endpoint}`;
        console.log(`Making SurePass API FormData request to: ${url}`);
        
        if (!SUREPASS_API_KEY) {
            console.error('SUREPASS_API_KEY is not set in environment');
            throw new Error('API key not configured');
        }
        
        // Create form data
        const formData = new FormData();
        formData.append(fieldName, fileBuffer, {
            filename: 'document.jpg',
            contentType: 'image/jpeg'
        });
        
        const response = await axios.post(url, formData, {
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_KEY}`,
                ...formData.getHeaders()
            },
            timeout: 30000 // 30-second timeout for file uploads
        });
        
        console.log(`SurePass API response status: ${response.status}`);
        console.log(`SurePass API response:`, JSON.stringify(response.data, null, 2));
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('SurePass API error (FormData):');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        } else if (error.request) {
            console.error(`No response received:`, error.request);
        } else {
            console.error(`Error setting up request:`, error.message);
        }
        
        return {
            success: false,
            error: error.response?.data?.error || error.message,
            statusCode: error.response?.status
        };
    }
};

/**
 * Verify Aadhaar by ID number
 * @param {String} aadhaarNumber - 12-digit Aadhaar number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response
 */
const verifyAadhaar = async (aadhaarNumber, consent = 'Y') => {
    try {
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Verifying Aadhaar: ${maskedAadhaar} with consent: ${consent}`);
        
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.'
            };
        }
        
        return await postJSON('/aadhaar-validation/aadhaar-validation', {
            id_number: cleanAadhaarNumber,
            consent
        });
    } catch (error) {
        console.error('Aadhaar verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate OTP for Aadhaar verification
 * @param {String} aadhaarNumber - 12-digit Aadhaar number
 * @returns {Promise} - API response with client_id for OTP verification
 */
const generateAadhaarOTP = async (aadhaarNumber) => {
    try {
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Generating OTP for Aadhaar: ${maskedAadhaar}`);
        
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.'
            };
        }
        
        const response = await postJSON('/aadhaar-v2/generate-otp', {
            id_number: cleanAadhaarNumber
        });
        
        console.log('DEBUG: Full OTP generation response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Aadhaar OTP generation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify Aadhaar OTP
 * @param {String} clientId - Client ID received from generate-otp response
 * @param {String} otp - OTP entered by user
 * @returns {Promise} - API response with verification details
 */
const verifyAadhaarOTP = async (clientId, otp) => {
    try {
        if (!clientId || !otp) {
            console.error('Missing client_id or OTP');
            return {
                success: false,
                error: 'Client ID and OTP are required.'
            };
        }
        
        console.log(`Verifying OTP for client ID: ${clientId}`);
        console.log(`OTP value: ${otp}`);
        
        const response = await postJSON('/aadhaar-v2/submit-otp', {
            client_id: clientId,
            otp: otp
        });
        
        console.log('DEBUG: Full OTP verification response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Aadhaar OTP verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify PAN by number
 * @param {String} panNumber - 10-character PAN number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response
 */
const verifyPAN = async (panNumber, consent = 'Y') => {
    try {
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Verifying PAN: ${cleanPanNumber} with consent: ${consent}`);
        
        if (cleanPanNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPanNumber)) {
            console.error('Invalid PAN number format');
            return {
                success: false,
                error: 'Invalid PAN number format. Must be 10 characters with format AAAAA0000A.'
            };
        }
        
        return await postJSON('/pan/pan', {
            id_number: cleanPanNumber,
            consent
        });
    } catch (error) {
        console.error('PAN verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Check Aadhaar-PAN link
 * @param {String} aadhaarNumber - 12-digit Aadhaar number
 * @param {String} panNumber - 10-character PAN number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response
 */
const checkAadhaarPANLink = async (aadhaarNumber, panNumber, consent = 'Y') => {
    try {
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Checking Aadhaar-PAN link: ${maskedAadhaar} with PAN: ${cleanPanNumber}`);
        
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.'
            };
        }
        
        if (cleanPanNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPanNumber)) {
            console.error('Invalid PAN number format');
            return {
                success: false,
                error: 'Invalid PAN number format. Must be 10 characters with format AAAAA0000A.'
            };
        }
        
        const requestBody = {
            aadhaar_number: cleanAadhaarNumber,
            consent: 'Y'
        };
        
        console.log(`DEBUG: API endpoint: /pan/aadhaar-pan-link-check`);
        console.log(`DEBUG: Request body:`, JSON.stringify(requestBody, null, 2));
        
        const result = await postJSON('/pan/aadhaar-pan-link-check', requestBody);
        
        console.log('DEBUG: Full Aadhaar-PAN link response structure:', JSON.stringify(result, null, 2));
        
        return result;
    } catch (error) {
        console.error('Aadhaar-PAN link check error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify Bank Account
 * @param {String} accountNumber - Bank account number
 * @param {String} ifsc - IFSC code
 * @param {String} accountHolderName - Optional account holder name for name matching
 * @param {Boolean} fetchIfscDetails - Whether to fetch IFSC details
 * @returns {Promise} - API response
 */
const verifyBankAccount = async (accountNumber, ifsc, accountHolderName = '', fetchIfscDetails = true) => {
    try {
        const cleanAccountNumber = accountNumber.replace(/\s/g, '');
        const cleanIfsc = ifsc.replace(/\s/g, '').toUpperCase();
        
        if (!cleanAccountNumber || !cleanIfsc) {
            console.error('Missing account number or IFSC code');
            return {
                success: false,
                error: 'Account number and IFSC code are required.'
            };
        }
        
        console.log(`Verifying bank account: ${cleanAccountNumber.substring(0, 4)}XXXX${cleanAccountNumber.slice(-4)} with IFSC: ${cleanIfsc}`);
        
        const requestPayload = {
            id_number: cleanAccountNumber,
            ifsc: cleanIfsc,
            ifsc_details: fetchIfscDetails
        };
        
        if (accountHolderName) {
            requestPayload.name = accountHolderName;
        }
        
        console.log(`DEBUG: Bank verification request payload:`, JSON.stringify(requestPayload, null, 2));
        
        const response = await postJSON('/bank-verification/', requestPayload);
        
        console.log('DEBUG: Full bank verification response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Bank account verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get RC details by chassis number
 * @param {String} chassisNumber - Vehicle chassis number
 * @returns {Promise} - API response
 */
const getChassisToRCDetails = async (chassisNumber) => {
    try {
        const cleanChassisNumber = chassisNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Getting RC details for chassis: ${cleanChassisNumber}`);
        
        if (!cleanChassisNumber || cleanChassisNumber.length < 10) {
            console.error('Invalid chassis number format');
            return {
                success: false,
                error: 'Invalid chassis number format. Must be at least 10 characters.'
            };
        }
        
        const response = await postJSON('/rc/chassis-to-rc-details', {
            chassis_number: cleanChassisNumber
        });
        
        console.log('DEBUG: Full chassis to RC response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Chassis to RC details error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get company details by CIN
 * @param {String} cin - Company Identification Number
 * @returns {Promise} - API response
 */
const getCompanyDetails = async (cin) => {
    try {
        const cleanCIN = cin.replace(/\s/g, '').toUpperCase();
        
        console.log(`Getting company details for CIN: ${cleanCIN}`);
        
        if (!cleanCIN || cleanCIN.length < 15) {
            console.error('Invalid CIN format');
            return {
                success: false,
                error: 'Invalid CIN format. Must be at least 15 characters.'
            };
        }
        
        const response = await postJSON('/corporate/company-details', {
            id_number: cleanCIN
        });
        
        console.log('DEBUG: Full company details response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Company details error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify DIN (Director Identification Number)
 * @param {String} dinNumber - Director Identification Number
 * @returns {Promise} - API response
 */
const verifyDIN = async (dinNumber) => {
    try {
        const cleanDIN = dinNumber.replace(/\s/g, '');
        
        console.log(`Verifying DIN: ${cleanDIN}`);
        
        if (!cleanDIN || cleanDIN.length !== 8 || !/^\d{8}$/.test(cleanDIN)) {
            console.error('Invalid DIN format');
            return {
                success: false,
                error: 'Invalid DIN format. Must be 8 digits.'
            };
        }
        
        const response = await postJSON('/corporate/din', {
            id_number: cleanDIN
        });
        
        console.log('DEBUG: Full DIN verification response structure:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('DIN verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify Driving License
 * @param {String} licenseNumber - Driving license number
 * @param {String} dob - Date of birth in YYYY-MM-DD format
 * @returns {Promise} - API response
 */
const verifyDrivingLicense = async (licenseNumber, dob) => {
    try {
        const cleanLicenseNumber = licenseNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Verifying Driving License: ${cleanLicenseNumber} with DOB: ${dob}`);
        
        if (!cleanLicenseNumber || cleanLicenseNumber.length < 10) {
            console.error('Invalid driving license number format');
            return {
                success: false,
                error: 'Invalid driving license number format. Must be at least 10 characters.'
            };
        }
        
        if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            console.error('Invalid date of birth format');
            return {
                success: false,
                error: 'Invalid date of birth format. Must be YYYY-MM-DD.'
            };
        }
        
        const response = await postJSON('/driving-license/driving-license', {
            id_number: cleanLicenseNumber,
            dob: dob
        });
        
        console.log('DEBUG: Full driving license verification response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Driving license verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get GSTIN Advanced Details
 * @param {String} gstin - 15-character GSTIN number
 * @returns {Promise} - API response
 */
const getGSTINAdvanced = async (gstin) => {
    try {
        const cleanGSTIN = gstin.replace(/\s/g, '').toUpperCase();
        
        console.log(`Getting GSTIN advanced details for: ${cleanGSTIN}`);
        
        if (!cleanGSTIN || cleanGSTIN.length !== 15) {
            console.error('Invalid GSTIN format');
            return {
                success: false,
                error: 'Invalid GSTIN format. Must be exactly 15 characters.'
            };
        }
        
        const response = await postJSON('/corporate/gstin-advanced', {
            id_number: cleanGSTIN
        });
        
        console.log('DEBUG: Full GSTIN advanced response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('GSTIN advanced details error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get GSTIN List by PAN
 * @param {String} panNumber - 10-character PAN number
 * @returns {Promise} - API response
 */
const getGSTINByPAN = async (panNumber) => {
    try {
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Getting GSTIN list for PAN: ${cleanPanNumber}`);
        
        if (cleanPanNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPanNumber)) {
            console.error('Invalid PAN number format');
            return {
                success: false,
                error: 'Invalid PAN number format. Must be 10 characters with format AAAAA0000A.'
            };
        }
        
        const response = await postJSON('/corporate/gstin-by-pan', {
            id_number: cleanPanNumber
        });
        
        console.log('DEBUG: Full GSTIN by PAN response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('GSTIN by PAN error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify Udyog Aadhaar (UDYAM)
 * @param {String} udyamNumber - Udyam registration number
 * @returns {Promise} - API response
 */
const verifyUdyogAadhaar = async (udyamNumber) => {
    try {
        const cleanUdyamNumber = udyamNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Verifying Udyog Aadhaar: ${cleanUdyamNumber}`);
        
        if (!cleanUdyamNumber || !cleanUdyamNumber.startsWith('UDYAM-')) {
            console.error('Invalid Udyam number format');
            return {
                success: false,
                error: 'Invalid Udyam number format. Must start with UDYAM-.'
            };
        }
        
        const response = await postJSON('/corporate/udyog-aadhaar', {
            id_number: cleanUdyamNumber
        });
        
        console.log('DEBUG: Full Udyog Aadhaar verification response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('Udyog Aadhaar verification error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * ITR Compliance Check
 * @param {String} panNumber - 10-character PAN number
 * @returns {Promise} - API response
 */
const checkITRCompliance = async (panNumber) => {
    try {
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Checking ITR compliance for PAN: ${cleanPanNumber}`);
        
        if (cleanPanNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPanNumber)) {
            console.error('Invalid PAN number format');
            return {
                success: false,
                error: 'Invalid PAN number format. Must be 10 characters with format AAAAA0000A.'
            };
        }
        
        const response = await postJSON('/itr/itr-compliance-check', {
            pan_number: cleanPanNumber
        });
        
        console.log('DEBUG: Full ITR compliance check response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('ITR compliance check error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get RC Full Details
 * @param {String} rcNumber - Vehicle registration number
 * @returns {Promise} - API response
 */
const getRCFullDetails = async (rcNumber) => {
    try {
        const cleanRCNumber = rcNumber.replace(/\s/g, '').toUpperCase();
        
        console.log(`Getting RC full details for: ${cleanRCNumber}`);
        
        if (!cleanRCNumber || cleanRCNumber.length < 8) {
            console.error('Invalid RC number format');
            return {
                success: false,
                error: 'Invalid RC number format. Must be at least 8 characters.'
            };
        }
        
        const response = await postJSON('/rc/rc-full', {
            id_number: cleanRCNumber
        });
        
        console.log('DEBUG: Full RC details response:', JSON.stringify(response, null, 2));
        
        return response;
    } catch (error) {
        console.error('RC full details error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Helper function to mask Aadhaar number for logging purposes
 * @param {String} aadhaarNumber - Aadhaar number to mask
 * @returns {String} - Masked Aadhaar number
 */
const maskAadhaarNumber = (aadhaarNumber) => {
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return 'invalid-aadhaar';
    }
    
    return `${aadhaarNumber.substring(0, 4)}XXXX${aadhaarNumber.substring(8)}`;
};

// Export all functions
module.exports = {
    postJSON,
    postFormData,
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPANLink,
    maskAadhaarNumber,
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