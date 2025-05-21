// services/localFiles.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FileUpload } = require('../models/FileUploads');

const saveFileLocally = async (file, userId, userRole = 'admin', entityType = 'campaign_request', entityId = null) => {
    // Fix: Define baseDir here
    const baseDir = path.join(process.env.LOCAL_STORAGE_PATH || 'public/uploads');
    
    // Create directory if it doesn't exist
    const entityDir = path.join(baseDir, entityType);
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(entityDir)) {
        fs.mkdirSync(entityDir, { recursive: true });
    }
    
    // Rest of your original function...
    const fileExt = path.extname(file.originalname);
    const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const relativePath = `/uploads/${entityType}/${filename}`;
    const filePath = path.join(baseDir, entityType, filename);
    
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