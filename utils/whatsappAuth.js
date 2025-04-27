const axios = require('axios');

const getAuth = async () => {
  const token = process.env.WHATSAPP_API_TOKEN; // Get your token from environment variable
  if (!token) {
    throw new Error('WhatsApp API token is required');
  }
  return token;
};

const makeApiRequest = async (url, method, data = {}) => {
  const token = await getAuth();
  
  try {
    const response = await axios({
      url,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      // Log the response error
      console.error('API Request Error:', error.response.data);
      throw new Error(`API Request failed: ${error.response.status} - ${error.response.statusText}`);
    } else {
      // Log the error message when no response is available
      console.error('API Request Error:', error.message);
      throw new Error(`API Request failed: ${error.message}`);
    }
  }
};

module.exports = { makeApiRequest };
