// middlewares/multer.js
const multer = require('multer');
const path = require('path');

// Use memory storage for processing uploads before storing to Firebase
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = {
        images: /jpeg|jpg|png|gif|webp/,
        documents: /pdf|doc|docx|txt|csv|xlsx|xls/,
        media: /mp4|mp3|wav|avi|mov/
    };
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    // Check if file type is allowed
    const isImage = allowedTypes.images.test(ext.substring(1)) || mimeType.startsWith('image/');
    const isDocument = allowedTypes.documents.test(ext.substring(1)) || 
        mimeType.includes('pdf') || 
        mimeType.includes('document') || 
        mimeType.includes('text') ||
        mimeType.includes('spreadsheet');
    const isMedia = allowedTypes.media.test(ext.substring(1)) || 
        mimeType.startsWith('video/') || 
        mimeType.startsWith('audio/');
    
    if (isImage || isDocument || isMedia) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.originalname}. Allowed types: images (jpeg, jpg, png, gif, webp), documents (pdf, doc, docx, txt, csv, xlsx, xls), and media files (mp4, mp3, wav, avi, mov)`));
    }
};

// Different size limits for different file types
const getSizeLimit = (req, file) => {
    const mimeType = file.mimetype.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
        return 10 * 1024 * 1024; // 10MB for images
    } else if (mimeType.startsWith('video/')) {
        return 100 * 1024 * 1024; // 100MB for videos
    } else if (mimeType.startsWith('audio/')) {
        return 50 * 1024 * 1024; // 50MB for audio
    } else {
        return 20 * 1024 * 1024; // 20MB for documents and others
    }
};

// Create multer instance with configuration
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
        files: 10,
        fields: 10
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum file size allowed is 100MB.'
            });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 10 files allowed.'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: `Upload error: ${err.message}`
            });
        }
    } else if (err) {
        // A custom error occurred
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    // No error occurred, proceed
    next();
};

// Export the main upload instance as default
module.exports = upload;

// Also export specific configurations for convenience
module.exports.uploadSingle = upload.single('file');
module.exports.uploadMultiple = upload.array('files', 10);
module.exports.uploadFields = upload.fields([
    { name: 'profile', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
    { name: 'images', maxCount: 10 }
]);
module.exports.handleMulterError = handleMulterError;