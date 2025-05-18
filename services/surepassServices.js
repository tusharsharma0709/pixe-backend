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
        console.log(`Request payload:`, data);
        
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`SurePass API response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('SurePass API error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Make a form-data POST request to SurePass API for file uploads
 * @param {String} endpoint - API endpoint path
 * @param {Buffer|String} fileBuffer - File buffer or path
 * @param {String} fieldName - Form field name for the file
 * @returns {Promise} - API response
 */
const postFormData = async (endpoint, fileBuffer, fieldName = 'file') => {
    try {
        const url = `${SUREPASS_BASE_URL}${endpoint}`;
        console.log(`Making SurePass file upload request to: ${url}`);
        
        const formData = new FormData();
        
        if (typeof fileBuffer === 'string') {
            // It's a file path, read it
            const fs = require('fs');
            const filename = fileBuffer.split('/').pop();
            formData.append(fieldName, fs.createReadStream(fileBuffer), filename);
        } else {
            // It's a buffer
            formData.append(fieldName, fileBuffer, {
                filename: `upload_${Date.now()}.jpg`,
                contentType: 'application/octet-stream'
            });
        }
        
        const response = await axios.post(url, formData, {
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_KEY}`,
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        console.log(`SurePass file upload response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('SurePass file upload error:', error.response?.data || error.message);
        throw error;
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
        return await postJSON('/api/v1/aadhaar-validation/aadhaar-validation', {
            id_number: aadhaarNumber,
            consent
        });
    } catch (error) {
        console.error('Aadhaar verification error:', error);
        throw error;
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
        return await postJSON('/api/v1/pan/pan', {
            pan: panNumber,
            consent
        });
    } catch (error) {
        console.error('PAN verification error:', error);
        throw error;
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
        return await postJSON('/api/v1/pan/aadhaar-pan-link-check', {
            id_number: aadhaarNumber,
            pan_number: panNumber,
            consent
        });
    } catch (error) {
        console.error('Aadhaar-PAN link check error:', error);
        throw error;
    }
};

/**
 * Generate OTP for Aadhaar verification
 * @param {String} aadhaarNumber - 12-digit Aadhaar number
 * @returns {Promise} - API response with client_id
 */
const generateAadhaarOTP = async (aadhaarNumber) => {
    try {
        return await postJSON('/api/v1/aadhaar-v2/generate-otp', {
            id_number: aadhaarNumber
        });
    } catch (error) {
        console.error('Aadhaar OTP generation error:', error);
        throw error;
    }
};

/**
 * Submit OTP for Aadhaar verification
 * @param {String} clientId - Client ID from OTP generation
 * @param {String} otp - OTP entered by user
 * @returns {Promise} - API response
 */
const submitAadhaarOTP = async (clientId, otp) => {
    try {
        return await postJSON('/api/v1/aadhaar-v2/submit-otp', {
            client_id: clientId,
            otp
        });
    } catch (error) {
        console.error('Aadhaar OTP submission error:', error);
        throw error;
    }
};

/**
 * Verify bank account via penny drop
 * @param {Object} data - Bank account data
 * @returns {Promise} - API response
 */
const verifyBankAccount = async (data) => {
    try {
        return await postJSON('/api/v1/bank-verification', data);
    } catch (error) {
        console.error('Bank verification error:', error);
        throw error;
    }
};

/**
 * Process OCR for Aadhaar card images
 * @param {Buffer} fileBuffer - File buffer of Aadhaar card image
 * @returns {Promise} - API response with OCR data
 */
const processAadhaarOCR = async (fileBuffer) => {
    try {
        return await postFormData('/api/ocr/aadhaar', fileBuffer);
    } catch (error) {
        console.error('Aadhaar OCR error:', error);
        throw error;
    }
};

/**
 * Process OCR for PAN card images
 * @param {Buffer} fileBuffer - File buffer of PAN card image
 * @returns {Promise} - API response with OCR data
 */
const processPANOCR = async (fileBuffer) => {
    try {
        return await postFormData('/api/ocr/pan', fileBuffer);
    } catch (error) {
        console.error('PAN OCR error:', error);
        throw error;
    }
};

/**
 * Get comprehensive PAN card information
 * @param {String} panNumber - PAN card number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response with comprehensive PAN info
 */
const getPANComprehensive = async (panNumber, consent = 'Y') => {
    try {
        return await postJSON('/api/v1/pan/pan-comprehensive', {
            pan: panNumber,
            consent
        });
    } catch (error) {
        console.error('PAN comprehensive error:', error);
        throw error;
    }
};

/**
 * Validate PAN format and basic authenticity
 * @param {String} panNumber - PAN card number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response
 */
const validatePAN = async (panNumber, consent = 'Y') => {
    try {
        return await postJSON('/api/v1/pan/validate', {
            pan: panNumber,
            consent
        });
    } catch (error) {
        console.error('PAN validation error:', error);
        throw error;
    }
};

module.exports = {
    postJSON,
    postFormData,
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPANLink,
    generateAadhaarOTP,
    submitAadhaarOTP,
    verifyBankAccount,
    processAadhaarOCR,
    processPANOCR,
    getPANComprehensive,
    validatePAN
};