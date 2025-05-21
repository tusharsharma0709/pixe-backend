// services/localFiles.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FileUpload } = require('../models/FileUploads');

/**
 * Save a file to local storage
 * @param {Object} file - Multer file object
 * @param {string} userId - ID of the user uploading the file
 * @param {string} userRole - Role of the user (admin, superadmin, etc.)
 * @param {string} entityType - Type of entity the file belongs to
 * @param {string|null} entityId - ID of the entity the file belongs to
 * @returns {Promise<Object>} - File upload record
 */
const saveFileLocally = async (file, userId, userRole = 'admin', entityType = 'campaign_request', entityId = null) => {
    // Create base uploads directory if it doesn't exist
    const baseDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    
    // Create entity-specific directory
    const entityDir = path.join(baseDir, entityType);
    if (!fs.existsSync(entityDir)) {
        fs.mkdirSync(entityDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const relativePath = `/uploads/${entityType}/${filename}`;
    
    // Save file to local storage
    fs.writeFileSync(filePath, file.buffer);
    
    // Get server base URL from environment or default
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    
    // Create file upload record
    const fileUpload = await FileUpload.create({
        filename,
        originalFilename: file.originalname,
        path: relativePath,
        url: `${baseUrl}${relativePath}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: {
            id: userId,
            role: userRole
        },
        adminId: userRole === 'admin' ? userId : null,
        superAdminId: userRole === 'superadmin' ? userId : null,
        entityType,
        entityId,
        status: 'permanent',
        isPublic: true,
        storageProvider: 'local'
    });
    
    return fileUpload;
};

module.exports = {
    saveFileLocally
};