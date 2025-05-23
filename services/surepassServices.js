// services/surepassServices.js - Updated with improved error handling and logging

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
 * Generate OTP for Aadhaar verification
 * @param {String} aadhaarNumber - 12-digit Aadhaar number
 * @returns {Promise} - API response with client_id for OTP verification
 */
const generateAadhaarOTP = async (aadhaarNumber) => {
    try {
        // Clean the Aadhaar number - remove spaces and any non-numeric characters
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        
        // Log the API call (without showing full Aadhaar number)
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Generating OTP for Aadhaar: ${maskedAadhaar}`);
        
        // Validate Aadhaar format
        if (cleanAadhaarNumber.length !== 12) {
            console.error('Invalid Aadhaar number format');
            return {
                success: false,
                error: 'Invalid Aadhaar number format. Must be 12 digits.'
            };
        }
        
        // Make API call to SurePass
        const response = await postJSON('/aadhaar-v2/generate-otp', {
            id_number: cleanAadhaarNumber
        });
        
        // Debug the response structure
        console.log('DEBUG: Full OTP generation response structure:', JSON.stringify(response, null, 2));
        
        // For debugging: Let's check all possible paths for client_id
        if (response.success) {
            let clientId = null;
            
            // Check direct path
            if (response.data?.client_id) {
                clientId = response.data.client_id;
                console.log(`Found client_id at response.data.client_id: ${clientId}`);
            }
            // Check nested path
            else if (response.data?.data?.client_id) {
                clientId = response.data.data.client_id;
                console.log(`Found client_id at response.data.data.client_id: ${clientId}`);
            }
            // Check if it's in a results array
            else if (response.data?.results && Array.isArray(response.data.results) && response.data.results[0]?.client_id) {
                clientId = response.data.results[0].client_id;
                console.log(`Found client_id in results array: ${clientId}`);
            }
            
            if (!clientId) {
                console.error('Client ID not found in any expected location in the response');
                console.log('Available keys in response.data:', Object.keys(response.data || {}));
                if (response.data?.data) {
                    console.log('Available keys in response.data.data:', Object.keys(response.data.data || {}));
                }
                
                // Even though we didn't find client_id, return the original response
                // to let the higher-level code handle this situation
            }
        }
        
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
        // Validate parameters
        if (!clientId || !otp) {
            console.error('Missing client_id or OTP');
            return {
                success: false,
                error: 'Client ID and OTP are required.'
            };
        }
        
        console.log(`Verifying OTP for client ID: ${clientId}`);
        console.log(`OTP value: ${otp}`);
        
        // Make API call to SurePass
        const response = await postJSON('/aadhaar-v2/submit-otp', {
            client_id: clientId,
            otp: otp
        });
        
        // Debug the response structure
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
const checkAadhaarPANLink = async (aadhaarNumber, panNumber, consent = 'Y') => {
    try {
        // Clean the numbers
        const cleanAadhaarNumber = aadhaarNumber.replace(/\D/g, '');
        const cleanPanNumber = panNumber.replace(/\s/g, '').toUpperCase();
        
        // Log the API call (without showing full Aadhaar number)
        const maskedAadhaar = maskAadhaarNumber(cleanAadhaarNumber);
        console.log(`Checking Aadhaar-PAN link: ${maskedAadhaar} with PAN: ${cleanPanNumber}`);
        
        // Validate inputs
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
        
        // CRITICAL FIX: Use the exact parameters as shown in the logs
        // From the logs, we see that API endpoint is "/pan/aadhaar-pan-link-check"
        // And parameters are "aadhaar_number" and "consent" (where consent = PAN number)
        const requestBody = {
            aadhaar_number: cleanAadhaarNumber,
            consent: cleanPanNumber // Based on the logs, 'consent' parameter is being used for PAN
        };
        
        console.log(`DEBUG: API endpoint: /pan/aadhaar-pan-link-check`);
        console.log(`DEBUG: Request body:`, JSON.stringify(requestBody, null, 2));
        
        // Make API call to SurePass with correct endpoint from logs
        const result = await postJSON('/pan/aadhaar-pan-link-check', requestBody);
        
        // Debug the response structure
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
        // Clean inputs
        const cleanAccountNumber = accountNumber.replace(/\s/g, '');
        const cleanIfsc = ifsc.replace(/\s/g, '').toUpperCase();
        
        // Validate inputs
        if (!cleanAccountNumber || !cleanIfsc) {
            console.error('Missing account number or IFSC code');
            return {
                success: false,
                error: 'Account number and IFSC code are required.'
            };
        }
        
        console.log(`Verifying bank account: ${cleanAccountNumber.substring(0, 4)}XXXX${cleanAccountNumber.slice(-4)} with IFSC: ${cleanIfsc}`);
        
        // Prepare request payload
        const requestPayload = {
            id_number: cleanAccountNumber,
            ifsc: cleanIfsc,
            ifsc_details: fetchIfscDetails
        };
        
        // Add account holder name if provided
        if (accountHolderName) {
            requestPayload.name = accountHolderName;
        }
        
        console.log(`DEBUG: Bank verification request payload:`, JSON.stringify(requestPayload, null, 2));
        
        // Make API call to SurePass
        const response = await postJSON('/bank-verification/', requestPayload);
        
        // Debug the response structure
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
    maskAadhaarNumber,
    generateAadhaarOTP,
    verifyAadhaarOTP,
    verifyBankAccount
};