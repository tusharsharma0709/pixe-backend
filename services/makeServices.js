const axios = require('axios');

// API Token for Make
const API_TOKEN = process.env.MAKE_API_TOKEN;

// Function to trigger a scenario in Make
const runMakeScenario = async (scenarioId, inputData) => {
  const url = `https://api.make.com/v2/scenarios/${scenarioId}/run`;

  try {
    const response = await axios.post(
      url,
      {
        input: inputData,  // Data you want to send to the scenario
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      }
    );

    return response.data; // Return the response from Make
  } catch (error) {
    console.error('Error triggering Make scenario:', error);
    throw error;
  }
};

// Function to get the list of scenarios
const getScenarios = async () => {
  const url = 'https://api.make.com/v2/scenarios';

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    throw error;
  }
};

// Function to create a webhook in Make
const createWebhook = async (scenarioId, webhookUrl) => {
  const url = 'https://api.make.com/v2/webhooks';

  try {
    const response = await axios.post(
      url,
      {
        scenarioId: scenarioId,
        url: webhookUrl,
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }
};

// Function to fetch logs from Make
const getLogs = async () => {
  const url = 'https://api.make.com/v2/logs';

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

module.exports = { runMakeScenario, getScenarios, createWebhook, getLogs };
