const makeService = require('../services/makeServices');

// Controller to trigger a scenario in Make
const triggerScenario = async (req, res) => {
  try {
    const { scenarioId, inputData } = req.body;

    if (!scenarioId || !inputData) {
      return res.status(400).json({ error: 'Scenario ID and input data are required' });
    }

    const response = await makeService.runMakeScenario(scenarioId, inputData);
    res.json(response);
  } catch (error) {
    console.error('Error triggering Make scenario:', error);
    res.status(500).json({ error: 'Failed to trigger Make scenario' });
  }
};

// Controller to get list of scenarios
const listScenarios = async (req, res) => {
  try {
    const response = await makeService.getScenarios();
    res.json(response);
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
};

// Controller to create a webhook in Make
const createWebhook = async (req, res) => {
  try {
    const { scenarioId, webhookUrl } = req.body;

    if (!scenarioId || !webhookUrl) {
      return res.status(400).json({ error: 'Scenario ID and webhook URL are required' });
    }

    const response = await makeService.createWebhook(scenarioId, webhookUrl);
    res.json(response);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
};

// Controller to get logs from Make
const fetchLogs = async (req, res) => {
  try {
    const logs = await makeService.getLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

module.exports = { triggerScenario, listScenarios, createWebhook, fetchLogs };
