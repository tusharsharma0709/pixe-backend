const axios = require('axios');

const axiosInstanceForSurepass = () => {
  return axios.create({
    baseURL: 'https://kyc-api.surepass.io', // SurePass base URL
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUREPASS_API_KEY}`
    }
  });
};

module.exports = {
  axiosInstanceForSurepass
};