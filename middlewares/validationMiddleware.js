// middleware/validationMiddleware.js - Request validation middleware

const { validationResult } = require('express-validator');

/**
 * Middleware to validate request data using express-validator
 * Should be used after validation rules in routes
 */
const validateRequest = (req, res, next) => {
    try {
        // Get validation errors from express-validator
        const errors = validationResult(req);
        
        // If no errors, continue to next middleware
        if (errors.isEmpty()) {
            return next();
        }
        
        // Format validation errors
        const formattedErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value,
            location: error.location
        }));
        
        console.log('❌ Validation errors:', formattedErrors);
        
        // Return validation error response
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: formattedErrors,
            totalErrors: formattedErrors.length
        });
        
    } catch (error) {
        console.error('Error in validation middleware:', error);
        
        return res.status(500).json({
            success: false,
            message: "Internal validation error",
            error: error.message
        });
    }
};

/**
 * Custom validation middleware for specific business rules
 */
const validateBusinessRules = {
    /**
     * Validate phone number format and country code
     */
    validatePhoneNumber: (fieldName = 'phone') => {
        return (req, res, next) => {
            const phoneNumber = req.body[fieldName];
            
            if (!phoneNumber) {
                return next(); // Skip if no phone number (handled by required validation)
            }
            
            // Remove all non-digit characters
            const cleaned = phoneNumber.replace(/\D/g, '');
            
            // Check if it's a valid Indian number
            if (cleaned.length === 10 && cleaned.startsWith('6,7,8,9'.split(',').some(d => cleaned.startsWith(d)))) {
                req.body[fieldName] = '+91' + cleaned;
                return next();
            }
            
            // Check if it already has country code
            if (cleaned.length === 12 && cleaned.startsWith('91')) {
                req.body[fieldName] = '+' + cleaned;
                return next();
            }
            
            // Check if it has + prefix
            if (phoneNumber.startsWith('+') && cleaned.length >= 10) {
                return next();
            }
            
            return res.status(400).json({
                success: false,
                message: `Invalid ${fieldName} format`,
                errors: [{
                    field: fieldName,
                    message: `${fieldName} must be a valid phone number`,
                    value: phoneNumber
                }]
            });
        };
    },
    
    /**
     * Validate date range (startDate should be before endDate)
     */
    validateDateRange: (startDateField = 'startDate', endDateField = 'endDate') => {
        return (req, res, next) => {
            const startDate = req.query[startDateField] || req.body[startDateField];
            const endDate = req.query[endDateField] || req.body[endDateField];
            
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                if (start >= end) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date range",
                        errors: [{
                            field: `${startDateField}, ${endDateField}`,
                            message: `${startDateField} must be before ${endDateField}`,
                            value: { startDate, endDate }
                        }]
                    });
                }
            }
            
            return next();
        };
    },
    
    /**
     * Validate pagination parameters
     */
    validatePagination: (req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        if (page < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination",
                errors: [{
                    field: 'page',
                    message: 'Page must be greater than 0',
                    value: page
                }]
            });
        }
        
        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination",
                errors: [{
                    field: 'limit',
                    message: 'Limit must be between 1 and 100',
                    value: limit
                }]
            });
        }
        
        // Add validated values to request
        req.pagination = { page, limit };
        return next();
    },
    
    /**
     * Validate file upload
     */
    validateFileUpload: (allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'], maxSize = 5 * 1024 * 1024) => {
        return (req, res, next) => {
            if (!req.file && !req.files) {
                return next(); // No file uploaded
            }
            
            const files = req.files || [req.file];
            
            for (const file of files) {
                if (!allowedTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid file type",
                        errors: [{
                            field: 'file',
                            message: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
                            value: file.originalname
                        }]
                    });
                }
                
                if (file.size > maxSize) {
                    return res.status(400).json({
                        success: false,
                        message: "File too large",
                        errors: [{
                            field: 'file',
                            message: `File size must be less than ${maxSize / (1024 * 1024)}MB`,
                            value: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
                        }]
                    });
                }
            }
            
            return next();
        };
    },
    
    /**
     * Validate MongoDB ObjectId
     */
    validateObjectId: (fieldName) => {
        return (req, res, next) => {
            const value = req.params[fieldName] || req.body[fieldName] || req.query[fieldName];
            
            if (!value) {
                return next(); // Skip if no value
            }
            
            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid ID format",
                    errors: [{
                        field: fieldName,
                        message: `${fieldName} must be a valid MongoDB ObjectId`,
                        value: value
                    }]
                });
            }
            
            return next();
        };
    },
    
    /**
     * Validate JSON format in request body
     */
    validateJSON: (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            return next();
        }
        
        return res.status(400).json({
            success: false,
            message: "Invalid JSON format",
            errors: [{
                field: 'body',
                message: 'Request body must be valid JSON',
                value: req.body
            }]
        });
    },
    
    /**
     * Validate required environment variables
     */
    validateEnvironment: (requiredVars = []) => {
        return (req, res, next) => {
            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            
            if (missingVars.length > 0) {
                console.error('Missing environment variables:', missingVars);
                
                return res.status(500).json({
                    success: false,
                    message: "Service configuration incomplete",
                    errors: [{
                        field: 'environment',
                        message: `Missing required environment variables: ${missingVars.join(', ')}`,
                        value: null
                    }]
                });
            }
            
            return next();
        };
    }
};

/**
 * Sanitize input data
 */
const sanitizeInput = {
    /**
     * Trim whitespace from string fields
     */
    trimStrings: (req, res, next) => {
        const trimObject = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key].trim();
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    trimObject(obj[key]);
                }
            }
        };
        
        if (req.body && typeof req.body === 'object') {
            trimObject(req.body);
        }
        
        return next();
    },
    
    /**
     * Convert string booleans to actual booleans
     */
    convertBooleans: (fields = []) => {
        return (req, res, next) => {
            fields.forEach(field => {
                if (req.body[field] !== undefined) {
                    if (req.body[field] === 'true' || req.body[field] === true) {
                        req.body[field] = true;
                    } else if (req.body[field] === 'false' || req.body[field] === false) {
                        req.body[field] = false;
                    }
                }
                
                if (req.query[field] !== undefined) {
                    if (req.query[field] === 'true') {
                        req.query[field] = true;
                    } else if (req.query[field] === 'false') {
                        req.query[field] = false;
                    }
                }
            });
            
            return next();
        };
    },
    
    /**
     * Remove empty strings and convert to null
     */
    handleEmptyStrings: (req, res, next) => {
        const processObject = (obj) => {
            for (const key in obj) {
                if (obj[key] === '') {
                    obj[key] = null;
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    processObject(obj[key]);
                }
            }
        };
        
        if (req.body && typeof req.body === 'object') {
            processObject(req.body);
        }
        
        return next();
    }
};

module.exports = {
    validateRequest,
    validateBusinessRules,
    sanitizeInput
};