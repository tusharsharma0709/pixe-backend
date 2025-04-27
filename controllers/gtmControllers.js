const gtmService = require('../services/gtmServices');

// ---------- ACCOUNTS ----------
const getAccounts = async (req, res) => {
  try {
    const accounts = await gtmService.getAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- CONTAINERS ----------
const getContainers = async (req, res) => {
  const { accountId } = req.params;
  try {
    const containers = await gtmService.getContainers(accountId);
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createContainer = async (req, res) => {
  const { accountId } = req.params;
  try {
    const container = await gtmService.createContainer(accountId, req.body);
    res.json(container);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateContainer = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    const updated = await gtmService.updateContainer(accountId, containerId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteContainer = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    await gtmService.deleteContainer(accountId, containerId);
    res.json({ message: 'Container deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- WORKSPACES ----------
const getWorkspaces = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    const workspaces = await gtmService.getWorkspaces(accountId, containerId);
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createWorkspace = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    const workspace = await gtmService.createWorkspace(accountId, containerId, req.body);
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateWorkspace = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const updated = await gtmService.updateWorkspace(accountId, containerId, workspaceId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteWorkspace = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    await gtmService.deleteWorkspace(accountId, containerId, workspaceId);
    res.json({ message: 'Workspace deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- TAGS ----------
const getTags = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const tags = await gtmService.getTags(accountId, containerId, workspaceId);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createTag = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const tag = await gtmService.createTag(accountId, containerId, workspaceId, req.body);
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTag = async (req, res) => {
  const { accountId, containerId, workspaceId, tagId } = req.params;
  try {
    const updated = await gtmService.updateTag(accountId, containerId, workspaceId, tagId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTag = async (req, res) => {
  const { accountId, containerId, workspaceId, tagId } = req.params;
  try {
    await gtmService.deleteTag(accountId, containerId, workspaceId, tagId);
    res.json({ message: 'Tag deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- TRIGGERS ----------
const getTriggers = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const triggers = await gtmService.getTriggers(accountId, containerId, workspaceId);
    res.json(triggers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createTrigger = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const trigger = await gtmService.createTrigger(accountId, containerId, workspaceId, req.body);
    res.json(trigger);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTrigger = async (req, res) => {
  const { accountId, containerId, workspaceId, triggerId } = req.params;
  try {
    const updated = await gtmService.updateTrigger(accountId, containerId, workspaceId, triggerId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTrigger = async (req, res) => {
  const { accountId, containerId, workspaceId, triggerId } = req.params;
  try {
    await gtmService.deleteTrigger(accountId, containerId, workspaceId, triggerId);
    res.json({ message: 'Trigger deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- VARIABLES ----------
const getVariables = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const variables = await gtmService.getVariables(accountId, containerId, workspaceId);
    res.json(variables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createVariable = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const variable = await gtmService.createVariable(accountId, containerId, workspaceId, req.body);
    res.json(variable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateVariable = async (req, res) => {
  const { accountId, containerId, workspaceId, variableId } = req.params;
  try {
    const updated = await gtmService.updateVariable(accountId, containerId, workspaceId, variableId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteVariable = async (req, res) => {
  const { accountId, containerId, workspaceId, variableId } = req.params;
  try {
    await gtmService.deleteVariable(accountId, containerId, workspaceId, variableId);
    res.json({ message: 'Variable deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- BUILT-IN VARIABLES ----------
const getBuiltInVariables = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const variables = await gtmService.getBuiltInVariables(accountId, containerId, workspaceId);
    res.json(variables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const enableBuiltInVariables = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  const { type } = req.body;
  try {
    const response = await gtmService.enableBuiltInVariables(accountId, containerId, workspaceId, type);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- FOLDERS ----------
const getFolders = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const folders = await gtmService.getFolders(accountId, containerId, workspaceId);
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createFolder = async (req, res) => {
  const { accountId, containerId, workspaceId } = req.params;
  try {
    const folder = await gtmService.createFolder(accountId, containerId, workspaceId, req.body);
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateFolder = async (req, res) => {
  const { accountId, containerId, workspaceId, folderId } = req.params;
  try {
    const updated = await gtmService.updateFolder(accountId, containerId, workspaceId, folderId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteFolder = async (req, res) => {
  const { accountId, containerId, workspaceId, folderId } = req.params;
  try {
    await gtmService.deleteFolder(accountId, containerId, workspaceId, folderId);
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------- ENVIRONMENTS ----------
const getEnvironments = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    const environments = await gtmService.getEnvironments(accountId, containerId);
    res.json(environments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEnvironment = async (req, res) => {
  const { accountId, containerId } = req.params;
  try {
    const env = await gtmService.createEnvironment(accountId, containerId, req.body);
    res.json(env);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateEnvironment = async (req, res) => {
  const { accountId, containerId, environmentId } = req.params;
  try {
    const updated = await gtmService.updateEnvironment(accountId, containerId, environmentId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteEnvironment = async (req, res) => {
  const { accountId, containerId, environmentId } = req.params;
  try {
    await gtmService.deleteEnvironment(accountId, containerId, environmentId);
    res.json({ message: 'Environment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  getAccounts,
  getContainers,
  createContainer,
  updateContainer,
  deleteContainer,

  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,

  getTags,
  createTag,
  updateTag,
  deleteTag,

  getTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,

  getVariables,
  createVariable,
  updateVariable,
  deleteVariable,

  getBuiltInVariables,
  enableBuiltInVariables,

  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,

  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
};
