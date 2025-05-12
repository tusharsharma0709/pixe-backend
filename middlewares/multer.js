// middlewares/upload.js
const multer = require('multer');
const path = require('path');

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
  const isImage = allowedTypes.images.test(ext) || mimeType.startsWith('image/');
  const isDocument = allowedTypes.documents.test(ext) || 
    mimeType.includes('pdf') || 
    mimeType.includes('document') || 
    mimeType.includes('text') ||
    mimeType.includes('spreadsheet');
  const isMedia = allowedTypes.media.test(ext) || 
    mimeType.startsWith('video/') || 
    mimeType.startsWith('audio/');
  
  if (isImage || isDocument || isMedia) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed types: images (jpeg, jpg, png, gif, webp), documents (pdf, doc, docx, txt, csv, xlsx, xls), and media files (mp4, mp3, wav, avi, mov)'));
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
    fileSize: 20 * 1024 * 1024, // 20MB default
    files: 10,
    fields: 10
  }
});

// Multiple file upload configuration
const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file for multiple uploads
    files: 10, // Maximum 10 files at once
    fields: 10
  }
});

// Export the main upload instance as default
module.exports = upload;

// Also export specific configurations for convenience
module.exports.uploadSingle = upload.single('file');
module.exports.uploadMultiple = uploadMultiple.array('files', 10);
module.exports.uploadFields = upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'documents', maxCount: 5 },
  { name: 'images', maxCount: 10 }
]);