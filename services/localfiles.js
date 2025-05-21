// services/localFiles.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FileUpload } = require('../models/FileUploads');
const { getBucket } = require('./firebase');

/**
 * Save file to Firebase Storage (replaces local storage)
 * @param {Object} file - Multer file object
 * @param {string} userId - ID of the user uploading the file
 * @param {string} userRole - Role of the user (admin, superadmin, etc.)
 * @param {string} entityType - Type of entity the file belongs to
 * @param {string|null} entityId - ID of the entity the file belongs to
 * @returns {Promise<Object>} - File upload record
 */
const saveFileLocally = async (file, userId, userRole = 'admin', entityType = 'campaign_request', entityId = null) => {
    try {
        // Generate unique filename
        const fileExt = path.extname(file.originalname);
        const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
        
        // Create folder structure by date: yyyy/mm/
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const filePath = `uploads/${entityType}/${year}/${month}/${filename}`;
        
        // Get Firebase Storage bucket
        const bucket = getBucket();
        
        // Create a file reference in Firebase Storage
        const fileRef = bucket.file(filePath);
        
        // Upload to Firebase
        await fileRef.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
                originalName: file.originalname
            },
            public: true,
            resumable: false
        });
        
        // Get public URL
        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        // Create file upload record
        const fileUpload = await FileUpload.create({
            filename,
            originalFilename: file.originalname,
            path: filePath,
            url: fileUrl,
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
            bucket: bucket.name,
            storageProvider: 'google_cloud',
            storageMetadata: {
                firebasePath: filePath
            }
        });
        
        console.log(`File uploaded to Firebase. URL: ${fileUrl}`);
        return fileUpload;
    } catch (error) {
        console.error("Error uploading to Firebase:", error);
        throw new Error(`Failed to upload file to Firebase: ${error.message}`);
    }
};

module.exports = {
    saveFileLocally
};