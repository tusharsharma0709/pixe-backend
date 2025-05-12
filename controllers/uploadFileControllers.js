// controllers/FileUploadController.js
const { FileUpload } = require('../models/FileUploads');
const { ActivityLog } = require('../models/ActivityLogs');
const admin = require('firebase-admin');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

// Get Firebase Storage bucket
const bucket = admin.storage().bucket();

const FileUploadController = {
    // Upload file
    uploadFile: async (req, res) => {
        try {
            const { userType, userId } = req;
            const file = req.file;
            const { entityType, entityId, isPublic = true } = req.body;
            
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file provided'
                });
            }
            
            // Determine uploader info
            let uploadedBy = { id: userId, role: userType };
            let uploaderFields = {};
            
            if (userType === 'superadmin') {
                uploaderFields.superAdminId = userId;
            } else if (userType === 'admin') {
                uploaderFields.adminId = userId;
            } else if (userType === 'agent') {
                uploaderFields.agentId = userId;
            } else if (userType === 'user') {
                uploaderFields.userId = userId;
            }
            
            // Generate unique filename
            const fileExt = path.extname(file.originalname);
            const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
            const filePath = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${filename}`;
            
            // Create a file in Firebase Storage
            const fileRef = bucket.file(filePath);
            
            // Upload file to Firebase Storage
            await fileRef.save(file.buffer, {
                metadata: {
                    contentType: file.mimetype,
                    originalName: file.originalname
                },
                public: isPublic,
                resumable: false
            });
            
            // Get public URL if file is public
            let fileUrl;
            if (isPublic) {
                fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            } else {
                // Generate signed URL for private files
                const [signedUrl] = await fileRef.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                });
                fileUrl = signedUrl;
            }
            
            // Process image if needed
            let imageMetadata = null;
            let thumbnailUrl = null;
            
            if (file.mimetype.startsWith('image/')) {
                try {
                    const metadata = await sharp(file.buffer).metadata();
                    imageMetadata = {
                        width: metadata.width,
                        height: metadata.height,
                        format: metadata.format,
                        hasAlpha: metadata.hasAlpha,
                        colorSpace: metadata.space,
                        orientation: metadata.orientation
                    };
                    
                    // Create thumbnail if it's an image
                    if (metadata.width > 200 || metadata.height > 200) {
                        const thumbnail = await sharp(file.buffer)
                            .resize(200, 200, { fit: 'inside' })
                            .toBuffer();
                            
                        const thumbnailPath = filePath.replace(filename, `thumb_${filename}`);
                        const thumbnailRef = bucket.file(thumbnailPath);
                        
                        await thumbnailRef.save(thumbnail, {
                            metadata: {
                                contentType: file.mimetype
                            },
                            public: isPublic,
                            resumable: false
                        });
                        
                        if (isPublic) {
                            thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailPath}`;
                        }
                    }
                } catch (error) {
                    console.error('Error processing image:', error);
                }
            }
            
            // Create file upload record
            const fileUpload = await FileUpload.create({
                filename,
                originalFilename: file.originalname,
                path: filePath,
                url: fileUrl,
                mimeType: file.mimetype,
                size: file.size,
                uploadedBy,
                ...uploaderFields,
                entityType: entityType || 'other',
                entityId,
                status: 'permanent',
                isPublic,
                bucket: bucket.name,
                storageProvider: 'google_cloud',
                storageMetadata: {
                    thumbnailUrl,
                    firebasePath: filePath
                },
                imageMetadata,
                isCompressed: false,
                originalSize: file.size
            });
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : userType === 'agent' ? 'Agents' : 'Users',
                action: 'custom',
                entityType: 'Other',
                entityId: fileUpload._id,
                description: `Uploaded file: ${file.originalname}`,
                status: 'success'
            });
            
            return res.status(201).json({
                success: true,
                data: {
                    file: fileUpload
                }
            });
        } catch (error) {
            console.error("Error in uploadFile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Upload multiple files
    uploadMultipleFiles: async (req, res) => {
        try {
            const { userType, userId } = req;
            const files = req.files;
            const { entityType, entityId, isPublic = true } = req.body;
            
            if (!files || files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No files provided'
                });
            }
            
            const uploadedFiles = [];
            const errors = [];
            
            for (const file of files) {
                try {
                    // Use the same logic as uploadFile for each file
                    req.file = file;
                    const result = await FileUploadController.uploadFile(req, res, true); // Pass true to skip response
                    if (result) {
                        uploadedFiles.push(result);
                    }
                } catch (error) {
                    errors.push({
                        filename: file.originalname,
                        error: error.message
                    });
                }
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    uploadedFiles,
                    errors
                }
            });
        } catch (error) {
            console.error("Error in uploadMultipleFiles:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get all files
    getAllFiles: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { entityType, entityId, status, isPublic, page = 1, limit = 10 } = req.query;
            
            let query = {};
            
            // Role-based access
            if (userType === 'superadmin') {
                // Super admin can see all files
            } else if (userType === 'admin') {
                query.adminId = userId;
            } else if (userType === 'agent') {
                query.agentId = userId;
            } else if (userType === 'user') {
                query.userId = userId;
            }
            
            // Apply filters
            if (entityType) query.entityType = entityType;
            if (entityId) query.entityId = entityId;
            if (status) query.status = status;
            if (isPublic !== undefined) query.isPublic = isPublic === 'true';
            
            const skip = (page - 1) * limit;
            
            const files = await FileUpload.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));
                
            const total = await FileUpload.countDocuments(query);
            
            return res.status(200).json({
                success: true,
                data: {
                    files,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error("Error in getAllFiles:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get file by ID
    getFile: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const file = await FileUpload.findById(id);
            
            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && file.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this file'
                });
            } else if (userType === 'agent' && file.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this file'
                });
            } else if (userType === 'user' && file.userId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this file'
                });
            }
            
            // Log file access
            await file.logAccess({
                accessedBy: { id: userId, role: userType },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    file
                }
            });
        } catch (error) {
            console.error("Error in getFile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Update file
    updateFile: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const updateData = req.body;
            
            const file = await FileUpload.findById(id);
            
            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && file.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this file'
                });
            } else if (userType === 'agent' && file.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this file'
                });
            } else if (userType === 'user' && file.userId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this file'
                });
            }
            
            // Allow updating certain fields only
            const allowedFields = ['entityType', 'entityId', 'tags', 'status', 'isPublic'];
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    file[key] = updateData[key];
                }
            });
            
            await file.save();
            
            return res.status(200).json({
                success: true,
                data: {
                    file
                }
            });
        } catch (error) {
            console.error("Error in updateFile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Delete file
    deleteFile: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const file = await FileUpload.findById(id);
            
            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && file.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to delete this file'
                });
            } else if (userType === 'agent' && file.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to delete this file'
                });
            } else if (userType === 'user' && file.userId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to delete this file'
                });
            }
            
            // Delete file from Firebase Storage
            try {
                const fileRef = bucket.file(file.path);
                await fileRef.delete();
                
                // Delete thumbnail if exists
                if (file.storageMetadata?.thumbnailUrl) {
                    const thumbnailRef = bucket.file(file.path.replace(file.filename, `thumb_${file.filename}`));
                    await thumbnailRef.delete().catch(err => console.log('Thumbnail delete error:', err));
                }
            } catch (error) {
                console.error('Error deleting file from Firebase:', error);
            }
            
            // Soft delete the record
            await FileUpload.markAsDeleted(file._id);
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : userType === 'admin' ? 'Admins' : userType === 'agent' ? 'Agents' : 'Users',
                action: 'custom',
                entityType: 'Other',
                entityId: file._id,
                description: `Deleted file: ${file.originalFilename}`,
                status: 'success'
            });
            
            return res.status(204).json({
                success: true,
                data: null
            });
        } catch (error) {
            console.error("Error in deleteFile:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get files by entity
    getFilesByEntity: async (req, res) => {
        try {
            const { entityType, entityId } = req.params;
            
            const files = await FileUpload.findByEntity(entityType, entityId);
            
            return res.status(200).json({
                success: true,
                data: {
                    files
                }
            });
        } catch (error) {
            console.error("Error in getFilesByEntity:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Make files permanent
    makeFilesPermanent: async (req, res) => {
        try {
            const { fileIds } = req.body;
            
            if (!fileIds || !Array.isArray(fileIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'File IDs must be provided as an array'
                });
            }
            
            const result = await FileUpload.makePermanent(fileIds);
            
            return res.status(200).json({
                success: true,
                data: {
                    result
                }
            });
        } catch (error) {
            console.error("Error in makeFilesPermanent:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get download URL for file
    getDownloadUrl: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { expiresIn = 3600 } = req.query; // Default 1 hour
            
            const file = await FileUpload.findById(id);
            
            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && file.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to download this file'
                });
            } else if (userType === 'agent' && file.agentId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to download this file'
                });
            } else if (userType === 'user' && file.userId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to download this file'
                });
            }
            
            // Generate signed URL for download
            const fileRef = bucket.file(file.path);
            const [signedUrl] = await fileRef.getSignedUrl({
                action: 'read',
                expires: Date.now() + parseInt(expiresIn) * 1000
            });
            
            // Log file access
            await file.logAccess({
                accessedBy: { id: userId, role: userType },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    downloadUrl: signedUrl,
                    expiresIn: parseInt(expiresIn)
                }
            });
        } catch (error) {
            console.error("Error in getDownloadUrl:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = FileUploadController;