const express = require('express');
const router = express.Router();
const gtmController = require('../controllers/gtmControllers');

// ✅ Account Routes
router.get('/accounts', gtmController.getAccounts);

// ✅ Container Routes
router.get('/accounts/:accountId/containers', gtmController.getContainers);
router.post('/accounts/:accountId/containers', gtmController.createContainer);
router.put('/accounts/:accountId/containers/:containerId', gtmController.updateContainer);
router.delete('/accounts/:accountId/containers/:containerId', gtmController.deleteContainer);

// ✅ Workspace Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces', gtmController.getWorkspaces);
router.post('/accounts/:accountId/containers/:containerId/workspaces', gtmController.createWorkspace);
router.put('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId', gtmController.updateWorkspace);
router.delete('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId', gtmController.deleteWorkspace);

// ✅ Tag Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags', gtmController.getTags);
router.post('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags', gtmController.createTag);
router.put('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags/:tagId', gtmController.updateTag);
router.delete('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags/:tagId', gtmController.deleteTag);

// ✅ Trigger Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers', gtmController.getTriggers);
router.post('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers', gtmController.createTrigger);
router.put('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers/:triggerId', gtmController.updateTrigger);
router.delete('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers/:triggerId', gtmController.deleteTrigger);

// ✅ Variable Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables', gtmController.getVariables);
router.post('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables', gtmController.createVariable);
router.put('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables/:variableId', gtmController.updateVariable);
router.delete('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables/:variableId', gtmController.deleteVariable);

// ✅ Built-In Variable Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/built-in-variables', gtmController.getBuiltInVariables);
router.post('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/built-in-variables', gtmController.enableBuiltInVariables);

// ✅ Folder Routes
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/folders', gtmController.getFolders);
router.post('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/folders', gtmController.createFolder);
router.put('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/folders/:folderId', gtmController.updateFolder);
router.delete('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/folders/:folderId', gtmController.deleteFolder);

// ✅ Environment Routes
router.get('/accounts/:accountId/containers/:containerId/environments', gtmController.getEnvironments);
router.post('/accounts/:accountId/containers/:containerId/environments', gtmController.createEnvironment);
router.put('/accounts/:accountId/containers/:containerId/environments/:environmentId', gtmController.updateEnvironment);
router.delete('/accounts/:accountId/containers/:containerId/environments/:environmentId', gtmController.deleteEnvironment);


module.exports = router;
