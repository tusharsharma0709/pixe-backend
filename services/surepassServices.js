const {axiosInstanceForSurepass} = require('../utils/axiosInstances');
const FormData = require('form-data');

const postJSON = async (endpoint, data) => {
  try {
    const instance = axiosInstanceForSurepass();
    const response = await instance.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error("Error in postJSON:", error.message);
    throw error;
  }
};

const postFormData = async (endpoint, fileBuffer, fieldName = 'file') => {
  try {
    const form = new FormData();
    form.append(fieldName, fileBuffer, 'document.jpg');
    
    const instance = axiosInstanceForSurepass();
    const response = await instance.post(endpoint, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.SUREPASS_API_KEY}`
      }
    });

    return response.data;
  } catch (error) {
    console.error("Error in postFormData:", error.message);
    throw error;
  }
};

module.exports = {
  postJSON,
  postFormData
};