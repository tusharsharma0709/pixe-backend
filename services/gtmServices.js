const { google } = require('googleapis');
const { getAuth } = require('../utils/googleAuth');

const tagmanager = google.tagmanager('v2');


// ========== ACCOUNTS ==========

const getAccounts = async () => {
  const auth = await getAuth(); // ✅ Make sure this line runs properly
  const res = await tagmanager.accounts.list({ auth });
  return res.data.account || [];
};

// ========== CONTAINERS ==========
const getContainers = async (accountId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.list({
    parent: `accounts/${accountId}`,
    auth,
  });
  return res.data.container || [];
};

const createContainer = async (accountId, containerData) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.create({
    parent: `accounts/${accountId}`,
    requestBody: containerData,
    auth,
  });
  return res.data;
};

const updateContainer = async (accountId, containerId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.update({
    path: `accounts/${accountId}/containers/${containerId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const deleteContainer = async (accountId, containerId) => {
  const auth = await getAuth();
  await tagmanager.accounts.containers.delete({
    path: `accounts/${accountId}/containers/${containerId}`,
    auth,
  });
};

// ========== WORKSPACES ==========
const getWorkspaces = async (accountId, containerId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.list({
    parent: `accounts/${accountId}/containers/${containerId}`,
    auth,
  });
  return res.data.workspace || [];
};

const createWorkspace = async (accountId, containerId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.create({
    parent: `accounts/${accountId}/containers/${containerId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const updateWorkspace = async (accountId, containerId, workspaceId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.update({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const deleteWorkspace = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  await tagmanager.accounts.containers.workspaces.delete({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
};

// ========== TAGS ==========
const getTags = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.tags.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
  return res.data.tag || [];
};

const createTag = async (accountId, containerId, workspaceId, tagData) => {
    const auth = await getAuth();
    const tagmanager = google.tagmanager('v2');
  
    const res = await tagmanager.accounts.containers.workspaces.tags.create({
      parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      requestBody: tagData,
      auth,
    });
  
    return res.data;
  };
  

const updateTag = async (accountId, containerId, workspaceId, tagId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.tags.update({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const deleteTag = async (accountId, containerId, workspaceId, tagId) => {
  const auth = await getAuth();
  await tagmanager.accounts.containers.workspaces.tags.delete({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
    auth,
  });
};

// ========== TRIGGERS ==========
const getTriggers = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.triggers.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
  return res.data.trigger || [];
};

const createTrigger = async (accountId, containerId, workspaceId, triggerData) => {
  const auth = await getAuth();
  const tagmanager = google.tagmanager('v2');

  const res = await tagmanager.accounts.containers.workspaces.triggers.create({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    requestBody: triggerData,
    auth,
  });

  return res.data;
};


const updateTrigger = async (accountId, containerId, workspaceId, triggerId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.triggers.update({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const deleteTrigger = async (accountId, containerId, workspaceId, triggerId) => {
  const auth = await getAuth();
  await tagmanager.accounts.containers.workspaces.triggers.delete({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
    auth,
  });
};

// ========== VARIABLES ==========
const getVariables = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.variables.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
  return res.data.variable || [];
};

const createVariable = async (accountId, containerId, workspaceId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.variables.create({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const updateVariable = async (accountId, containerId, workspaceId, variableId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.variables.update({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
    requestBody: data,
    auth,
  });
  return res.data;
};

const deleteVariable = async (accountId, containerId, workspaceId, variableId) => {
  const auth = await getAuth();
  await tagmanager.accounts.containers.workspaces.variables.delete({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
    auth,
  });
};

// ========== BUILT-IN VARIABLES ==========
const getBuiltInVariables = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.built_in_variables.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
  return res.data.builtInVariable || [];
};

const enableBuiltInVariables = async (accountId, containerId, workspaceId, typeList) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.built_in_variables.create({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    type: typeList,
    auth,
  });
  return res.data;
};

// ========== FOLDERS ==========
const getFolders = async (accountId, containerId, workspaceId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.folders.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    auth,
  });
  return res.data.folder || [];
};

const createFolder = async (accountId, containerId, workspaceId, folderData) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.folders.create({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
    requestBody: folderData, // 👈 yeh zaruri hai
    auth,
  });
  return res.data || [];
};

const updateFolder = async (accountId, containerId, workspaceId, folderId, folderData) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.folders.update({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
    requestBody: folderData,
    auth,
  });
  return res.data || {};
};

const deleteFolder = async (accountId, containerId, workspaceId, folderId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.workspaces.folders.delete({
    path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
    auth,
  });
  return res.status === 200 || res.status === 204;
};


// ========== ENVIRONMENTS ==========
const getEnvironments = async (accountId, containerId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.environments.list({
    parent: `accounts/${accountId}/containers/${containerId}`,
    auth,
  });
  return res.data.environment || [];
};

const createEnvironment = async (accountId, containerId, data) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.environments.create({
    parent: `accounts/${accountId}/containers/${containerId}`,
    requestBody: data, // contains name, type, url, description etc.
    auth,
  });
  return res.data;
};

const updateEnvironment = async (accountId, containerId, environmentId, data, fingerprint) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.environments.update({
    path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
    requestBody: {
      ...data,
      fingerprint, // mandatory for update
    },
    auth,
  });
  return res.data;
};

const deleteEnvironment = async (accountId, containerId, environmentId) => {
  const auth = await getAuth();
  const res = await tagmanager.accounts.containers.environments.delete({
    path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
    auth,
  });
  return res.status === 200 || res.status === 204;
};

// Exporting All
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
