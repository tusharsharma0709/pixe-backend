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
    // Create directories and save file - existing code remains unchanged
    
    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const relativePath = `/uploads/${entityType}/${filename}`;
    const filePath = path.join(baseDir, entityType, filename);
    
    // Save file to local storage
    fs.writeFileSync(filePath, file.buffer);
    
    // Format URL consistently
    let url;
    if (process.env.USE_RELATIVE_URLS === 'true') {
        url = relativePath;
    } else {
        const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        url = `${baseUrl}${relativePath}`;
    }
    
    // Create file upload record
    const fileUpload = await FileUpload.create({
        filename,
        originalFilename: file.originalname,
        path: relativePath,
        url: url,
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