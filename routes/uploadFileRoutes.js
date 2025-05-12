// routes/fileUploadRoutes.js
const express = require('express');
const router = express.Router();
const FileUploadController = require('../controllers/uploadFileControllers');
const { superAdminAuth, adminAuth, agentAuth, adminOrAgentAuth } = require('../middlewares/auth');
const { uploadSingle, uploadMultiple } = require('../middlewares/multer');

// Upload single file (all authenticated users)
router.post('/upload', adminOrAgentAuth, uploadSingle, FileUploadController.uploadFile);

// Upload multiple files (all authenticated users)
router.post('/upload-multiple', adminOrAgentAuth, uploadMultiple, FileUploadController.uploadMultipleFiles);

// Get all files (filtered by user role)
router.get('/', adminOrAgentAuth, FileUploadController.getAllFiles);

// Get file by ID
router.get('/:id', adminOrAgentAuth, FileUploadController.getFile);

// Update file metadata
router.put('/:id', adminOrAgentAuth, FileUploadController.updateFile);

// Delete file (soft delete)
router.delete('/:id', adminOrAgentAuth, FileUploadController.deleteFile);

// Get files by entity
router.get('/entity/:entityType/:entityId', adminOrAgentAuth, FileUploadController.getFilesByEntity);

// Make files permanent (remove temporary status)
router.post('/make-permanent', adminOrAgentAuth, FileUploadController.makeFilesPermanent);

// Get download URL for file
router.get('/:id/download-url', adminOrAgentAuth, FileUploadController.getDownloadUrl);

module.exports = router;