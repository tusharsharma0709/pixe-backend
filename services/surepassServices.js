// services/surepassServices.js
const axios = require('axios');
require('dotenv').config();

const SUREPASS_API_URL = process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io';
const SUREPASS_API_KEY = process.env.SUREPASS_API_KEY;

/**
 * Helper to make POST requests to SurePass API with JSON data
 * @param {string} endpoint - API endpoint path
 * @param {object} data - JSON data to send
 * @returns {Promise<object>} Response from SurePass API
 */
const postJSON = async (endpoint, data) => {
  try {
    const url = `${SUREPASS_API_URL}${endpoint}`;
    
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUREPASS_API_KEY}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('SurePass API Error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Helper to make POST requests to SurePass API with form data (files)
 * @param {string} endpoint - API endpoint path
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} fieldName - Name of the field for the file
 * @returns {Promise<object>} Response from SurePass API
 */
const postFormData = async (endpoint, fileBuffer, fieldName = 'file') => {
  try {
    const url = `${SUREPASS_API_URL}${endpoint}`;
    
    // Create form data
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append(fieldName, fileBuffer, {
      filename: 'document.jpg',
      contentType: 'image/jpeg'
    });
    
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${SUREPASS_API_KEY}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('SurePass API Error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Helper to make GET requests to SurePass API
 * @param {string} endpoint - API endpoint path
 * @param {object} params - Query parameters
 * @returns {Promise<object>} Response from SurePass API
 */
const get = async (endpoint, params = {}) => {
  try {
    const url = `${SUREPASS_API_URL}${endpoint}`;
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${SUREPASS_API_KEY}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('SurePass API Error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

module.exports = {
  postJSON,
  postFormData,
  get
};