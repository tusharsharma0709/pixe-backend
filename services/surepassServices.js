// services/surepassServices.js - Corrected with exact API endpoints and params

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
            // The server responded with a status code outside of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
            console.error(`Headers:`, error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`No response received:`, error.request);
        } else {
            // Something happened in setting up the request
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
            // The server responded with a status code outside of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`No response received:`, error.request);
        } else {
            // Something happened in setting up the request
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
        // Clean the Aadhaar number - remove spaces and any non-numeric characters
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        
        // Log the API call (without showing full Aadhaar number)
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Verifying Aadhaar: ${maskedAadhaar} with consent: ${consent}`);
        
        // Validate Aadhaar format
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.'
            };
        }
        
        // Make API call to SurePass
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
 * Verify PAN by number
 * @param {String} panNumber - 10-character PAN number
 * @param {String} consent - Consent flag (Y/N)
 * @returns {Promise} - API response
 */
const verifyPAN = async (panNumber, consent = 'Y') => {
    try {
        // Clean the PAN number - remove spaces and convert to uppercase
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        // Log the API call
        console.log(`Verifying PAN: ${cleanPanNumber} with consent: ${consent}`);
        
        // Validate PAN format (10 characters, starts with letter, etc.)
        if (cleanPanNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPanNumber)) {
            console.error('Invalid PAN number format');
            return {
                success: false,
                error: 'Invalid PAN number format. Must be 10 characters with format AAAAA0000A.'
            };
        }
        
        // Make API call to SurePass - Using id_number parameter
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
const checkAadhaarPANLink = async (aadhaarNumber, consent = 'Y') => {
    try {
        // Validate inputs first
        if (!aadhaarNumber) {
            console.error('Aadhaar number is required');
            return {
                success: false,
                error: 'Aadhaar number is required',
                isLinked: false
            };
        }
        
        // Clean the numbers - only after confirming they exist
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        
        // Log the API call (without showing full Aadhaar number)
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Checking Aadhaar-PAN link: ${maskedAadhaar} - ${cleanPanNumber} with consent: ${consent}`);
        
        // Validate inputs
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.',
                isLinked: false
            };
        }
        
        // Make API call to SurePass
        // IMPORTANT: Using 'id_number' instead of 'pan' based on API errors
        const result = await postJSON('/pan/aadhaar-pan-link-check', {
            aadhaar_number: cleanAadhaarNumber,
            consent
        });
        
        // Add isLinked flag for easier access
        if (result.success && result.data && result.data.linking_status) {
            result.isLinked = result.data.linking_status === 'Y' || result.data.linking_status === true;
        } else {
            result.isLinked = false;
        }
        
        return result;
    } catch (error) {
        console.error('Aadhaar-PAN link check error:', error);
        return {
            success: false,
            error: error.message,
            isLinked: false
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

// Export the functions
module.exports = {
    postJSON,
    postFormData,
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPANLink,
    maskAadhaarNumber
};