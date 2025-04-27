const express = require('express');
const router = express.Router();
const makeController = require('../controllers/makeControllers');

// Route to trigger a Make scenario
router.post('/trigger-scenario', makeController.triggerScenario);

// Route to get list of scenarios
router.get('/scenarios', makeController.listScenarios);

// Route to create a webhook in Make
router.post('/create-webhook', makeController.createWebhook);

// Route to fetch logs
router.get('/logs', makeController.fetchLogs);

module.exports = router;
