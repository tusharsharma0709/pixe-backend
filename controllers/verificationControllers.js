// controllers/verificationController.js
const { User } = require('../models/Users');
const { Verification } = require('../models/Verifications');
const { FileUpload } = require('../models/FileUploads');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const axios = require('axios');
const multer = require('multer');
const upload = require('../middlewares/multer');
require('dotenv').config();

/**
 * Helper function to extract name from verification response
 */
const extractName = (data, verificationType) => {
    if (!data) return null;
    
    try {
        if (verificationType === 'aadhaar') {
            if (data.ocr_fields && data.ocr_fields.length > 0 && data.ocr_fields[0].full_name) {
                return data.ocr_fields[0].full_name.value;
            }
        } else if (verificationType === 'pan') {
            if (data.ocr_fields && data.ocr_fields.length > 0 && data.ocr_fields[0].full_name) {
                return data.ocr_fields[0].full_name.value;
            }
        }
    } catch (error) {
        console.error('Error extracting name:', error);
    }
    
    return null;
};

/**
 * Helper function to check if names match
 */
const doNamesMatch = (dbName, verificationName) => {
    if (!dbName || !verificationName) return false;
    
    // Convert both names to lowercase and remove extra spaces
    const normalizedDbName = dbName.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedVerificationName = verificationName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Check for exact match first
    if (normalizedDbName === normalizedVerificationName) {
        return true;
    }
    
    // Check if one name contains the other (for partial matches)
    return normalizedVerificationName.includes(normalizedDbName) || 
           normalizedDbName.includes(normalizedVerificationName);
};

/**
 * Process Aadhaar OCR verification
 */
const aadhaarOCR = async (req, res) => {
    try {
        // Get userId from request (from auth middleware)
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check for files
        if (!req.files || !req.files.aadhaarFront || !req.files.aadhaarBack) {
            return res.status(400).json({ 
                success: false, 
                message: 'Both Aadhaar front and back documents are required' 
            });
        }
        
        const frontFile = req.files.aadhaarFront[0];
        const backFile = req.files.aadhaarBack[0];
        
        // Create file records
        const frontFileUpload = new FileUpload({
            filename: frontFile.filename || `aadhaar_front_${Date.now()}`,
            originalFilename: frontFile.originalname,
            path: frontFile.path || frontFile.location,
            url: frontFile.location || frontFile.path,
            mimeType: frontFile.mimetype,
            size: frontFile.size,
            uploadedBy: {
                id: userId,
                role: 'user'
            },
            userId,
            entityType: 'verification',
            isScanRequired: true
        });
        
        const backFileUpload = new FileUpload({
            filename: backFile.filename || `aadhaar_back_${Date.now()}`,
            originalFilename: backFile.originalname,
            path: backFile.path || backFile.location,
            url: backFile.location || backFile.path,
            mimeType: backFile.mimetype,
            size: backFile.size,
            uploadedBy: {
                id: userId,
                role: 'user'
            },
            userId,
            entityType: 'verification',
            isScanRequired: true
        });
        
        await Promise.all([
            frontFileUpload.save(),
            backFileUpload.save()
        ]);
        
        // Find existing verification or create new one
        let verification = await Verification.findOne({
            userId,
            verificationType: 'aadhaar'
        });
        
        if (!verification) {
            verification = new Verification({
                userId,
                verificationType: 'aadhaar',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress',
                documents: [
                    {
                        type: 'aadhaar_front',
                        url: frontFileUpload.url,
                        status: 'pending'
                    },
                    {
                        type: 'aadhaar_back',
                        url: backFileUpload.url,
                        status: 'pending'
                    }
                ]
            });
        } else {
            // Update existing verification
            verification.status = 'in_progress';
            verification.documents.push(
                {
                    type: 'aadhaar_front',
                    url: frontFileUpload.url,
                    status: 'pending'
                },
                {
                    type: 'aadhaar_back',
                    url: backFileUpload.url,
                    status: 'pending'
                }
            );
        }
        
        await verification.save();
        
        // Now send files to SurePass API for OCR
        const frontApiResponse = await callSurepassAPI('ocr/aadhaar', frontFile.buffer || frontFile.path);
        const backApiResponse = await callSurepassAPI('ocr/aadhaar', backFile.buffer || backFile.path);
        
        // Process API responses
        if (frontApiResponse.success && backApiResponse.success) {
            // Merge data from front and back
            const mergedData = {
                front: frontApiResponse.data,
                back: backApiResponse.data
            };
            
            // Extract Aadhaar number and name
            let aadhaarNumber = null;
            let aadhaarName = null;
            
            if (frontApiResponse.data && 
                frontApiResponse.data.ocr_fields && 
                frontApiResponse.data.ocr_fields.length > 0) {
                
                const fields = frontApiResponse.data.ocr_fields[0];
                
                if (fields.aadhaar_number) {
                    aadhaarNumber = fields.aadhaar_number.value;
                }
                
                if (fields.full_name) {
                    aadhaarName = fields.full_name.value;
                }
            }
            
            // Get name from user profile
            const dbName = user.name || '';
            
            // Check if Aadhaar name was found
            if (!aadhaarName) {
                // Update verification status
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Could not extract name from Aadhaar card'
                });
                await verification.save();
                
                return res.status(400).json({
                    success: false,
                    message: 'Could not extract name from Aadhaar card',
                    data: {
                        registeredName: dbName
                    }
                });
            }
            
            // Check if names match when user has a name
            const namesMatch = !dbName || doNamesMatch(dbName, aadhaarName);
            if (dbName && !namesMatch) {
                // Update verification status
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Name in Aadhaar card does not match registered name',
                    data: {
                        dbName,
                        aadhaarName
                    }
                });
                await verification.save();
                
                return res.status(400).json({
                    success: false,
                    message: 'Name in Aadhaar card does not match your registered name',
                    data: {
                        dbName: dbName,
                        aadhaarName: aadhaarName
                    }
                });
            }
            
            // Update verification with successful results
            verification.status = 'completed';
            verification.verificationDetails = {
                aadhaarNumber,
                aadhaarName,
                nameMatch: {
                    status: namesMatch,
                    score: namesMatch ? 100 : 0
                }
            };
            verification.responseData = mergedData;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    aadhaarNumber,
                    aadhaarName
                }
            });
            
            // Also update document status
            verification.documents.forEach(doc => {
                if (doc.type === 'aadhaar_front' || doc.type === 'aadhaar_back') {
                    doc.status = 'approved';
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isAadhaarVerified = true;
            await user.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: verification._id,
                description: 'Aadhaar verification completed successfully',
                details: {
                    verificationType: 'aadhaar',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'Aadhaar OCR processed successfully',
                data: {
                    aadhaarName,
                    aadhaarNumber: aadhaarNumber ? aadhaarNumber.substring(0, 4) + ' XXXX XXXX' : null,
                    isVerified: true
                }
            });
        } else {
            // Handle API error
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Failed to extract information from Aadhaar documents',
                data: {
                    frontResponse: frontApiResponse,
                    backResponse: backApiResponse
                }
            });
            await verification.save();
            
            return res.status(400).json({
                success: false,
                message: 'Failed to extract information from Aadhaar documents',
                error: frontApiResponse.error || backApiResponse.error || 'OCR processing failed'
            });
        }
    } catch (error) {
        console.error('Error in Aadhaar OCR verification:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Process PAN card verification
 */
const panVerification = async (req, res) => {
    try {
        // Get userId from request (from auth middleware)
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if Aadhaar is verified first
        if (!user.isAadhaarVerified) {
            return res.status(400).json({
                success: false,
                message: 'Please verify your Aadhaar first'
            });
        }
        
        // Check for file
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'PAN document is required' 
            });
        }
        
        const file = req.file;
        
        // Create file record
        const fileUpload = new FileUpload({
            filename: file.filename || `pan_${Date.now()}`,
            originalFilename: file.originalname,
            path: file.path || file.location,
            url: file.location || file.path,
            mimeType: file.mimetype,
            size: file.size,
            uploadedBy: {
                id: userId,
                role: 'user'
            },
            userId,
            entityType: 'verification',
            isScanRequired: true
        });
        
        await fileUpload.save();
        
        // Find existing verification or create new one
        let verification = await Verification.findOne({
            userId,
            verificationType: 'pan'
        });
        
        if (!verification) {
            verification = new Verification({
                userId,
                verificationType: 'pan',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress',
                documents: [
                    {
                        type: 'pan',
                        url: fileUpload.url,
                        status: 'pending'
                    }
                ]
            });
        } else {
            // Update existing verification
            verification.status = 'in_progress';
            verification.documents.push({
                type: 'pan',
                url: fileUpload.url,
                status: 'pending'
            });
        }
        
        await verification.save();
        
        // Now send file to SurePass API for OCR
        const apiResponse = await callSurepassAPI('ocr/pan', file.buffer || file.path);
        
        // Process API response
        if (apiResponse.success) {
            // Extract PAN number and name
            let panNumber = null;
            let panName = null;
            
            if (apiResponse.data && 
                apiResponse.data.ocr_fields && 
                apiResponse.data.ocr_fields.length > 0) {
                
                const fields = apiResponse.data.ocr_fields[0];
                
                if (fields.pan_number) {
                    panNumber = fields.pan_number.value;
                }
                
                if (fields.full_name) {
                    panName = fields.full_name.value;
                }
            }
            
            // Get name from user profile
            const dbName = user.name || '';
            
            // Check if PAN name was found
            if (!panName) {
                // Update verification status
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Could not extract name from PAN card'
                });
                await verification.save();
                
                return res.status(400).json({
                    success: false,
                    message: 'Could not extract name from PAN card',
                    data: {
                        registeredName: dbName
                    }
                });
            }
            
            // Check if names match when user has a name
            const namesMatch = !dbName || doNamesMatch(dbName, panName);
            if (dbName && !namesMatch) {
                // Update verification status
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Name in PAN card does not match registered name',
                    data: {
                        dbName,
                        panName
                    }
                });
                await verification.save();
                
                return res.status(400).json({
                    success: false,
                    message: 'Name in PAN card does not match your registered name',
                    data: {
                        dbName: dbName,
                        panName: panName
                    }
                });
            }
            
            // Update verification with successful results
            verification.status = 'completed';
            verification.verificationDetails = {
                panNumber,
                panName,
                nameMatch: {
                    status: namesMatch,
                    score: namesMatch ? 100 : 0
                }
            };
            verification.responseData = apiResponse.data;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    panNumber,
                    panName
                }
            });
            
            // Also update document status
            verification.documents.forEach(doc => {
                if (doc.type === 'pan') {
                    doc.status = 'approved';
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isPanVerified = true;
            await user.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: verification._id,
                description: 'PAN verification completed successfully',
                details: {
                    verificationType: 'pan',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'PAN document processed successfully',
                data: {
                    panName,
                    panNumber: panNumber ? 
                        panNumber.substring(0, 2) + 'XXXXX' + panNumber.substring(7) : null,
                    isVerified: true
                }
            });
        } else {
            // Handle API error
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Failed to extract information from PAN document',
                data: apiResponse
            });
            await verification.save();
            
            return res.status(400).json({
                success: false,
                message: 'Failed to extract information from PAN document',
                error: apiResponse.error || 'OCR processing failed'
            });
        }
    } catch (error) {
        console.error('Error in PAN verification:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Check if Aadhaar and PAN are linked
 */
const aadhaarPanLink = async (req, res) => {
    try {
        // Get userId from request (from auth middleware)
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if Aadhaar and PAN are verified
        if (!user.isAadhaarVerified) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar is not verified yet. Please verify your Aadhaar first.'
            });
        }
        
        if (!user.isPanVerified) {
            return res.status(400).json({
                success: false,
                message: 'PAN is not verified yet. Please verify your PAN first.'
            });
        }
        
        // Get verification records
        const aadhaarVerification = await Verification.findOne({ 
            userId, 
            verificationType: 'aadhaar',
            status: 'completed'
        });
        
        const panVerification = await Verification.findOne({ 
            userId, 
            verificationType: 'pan',
            status: 'completed'
        });
        
        if (!aadhaarVerification || !panVerification) {
            return res.status(400).json({
                success: false,
                message: 'Verification records not found. Please complete verification process first.'
            });
        }
        
        // Check if Aadhaar number and PAN number are present
        if (!aadhaarVerification.verificationDetails?.aadhaarNumber) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar number is missing in verification records. Please verify your Aadhaar again.'
            });
        }
        
        if (!panVerification.verificationDetails?.panNumber) {
            return res.status(400).json({
                success: false,
                message: 'PAN number is missing in verification records. Please verify your PAN again.'
            });
        }
        
        // Create a new verification record for Aadhaar-PAN link
        let linkVerification = await Verification.findOne({ 
            userId, 
            verificationType: 'aadhaar_pan_link'
        });
        
        if (!linkVerification) {
            linkVerification = new Verification({
                userId,
                verificationType: 'aadhaar_pan_link',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress'
            });
        } else {
            linkVerification.status = 'in_progress';
        }
        
        await linkVerification.save();
        
        // Call SurePass API to check if Aadhaar and PAN are linked
        const apiResponse = await callSurepassAPI('pan-aadhaar-link/pan-link-status', {
            id_number: aadhaarVerification.verificationDetails.aadhaarNumber,
            consent: "Y",
            pan_number: panVerification.verificationDetails.panNumber
        }, 'POST');
        
        // Process API response
        if (apiResponse.success) {
            // Update verification with successful results
            linkVerification.status = 'completed';
            linkVerification.responseData = apiResponse.data;
            linkVerification.completedAt = new Date();
            linkVerification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: apiResponse.data
            });
            
            await linkVerification.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: linkVerification._id,
                description: 'Aadhaar-PAN link verification completed successfully',
                details: {
                    verificationType: 'aadhaar_pan_link',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'Aadhaar and PAN link status checked successfully',
                data: apiResponse.data
            });
        } else {
            // Handle API error
            linkVerification.status = 'failed';
            linkVerification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Failed to check Aadhaar-PAN link',
                data: apiResponse
            });
            await linkVerification.save();
            
            return res.status(400).json({
                success: false,
                message: 'Failed to check Aadhaar-PAN link',
                error: apiResponse.error || 'API call failed'
            });
        }
    } catch (error) {
        console.error('Error in verifying Aadhaar-PAN link:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Generate Aadhaar OTP for verification
 */
const generateAadhaarOTP = async (req, res) => {
    try {
        // Get userId from request (from auth middleware)
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if Aadhaar is already verified
        if (!user.isAadhaarVerified) {
            return res.status(400).json({
                success: false,
                message: 'Please complete Aadhaar OCR verification first'
            });
        }
        
        // Check if already validated
        if (user.isAadhaarValidated) {
            return res.status(200).json({
                success: true,
                message: 'Aadhaar is already validated',
                data: {
                    isAadhaarValidated: true
                }
            });
        }
        
        // Get Aadhaar verification data
        const aadhaarVerification = await Verification.findOne({ 
            userId, 
            verificationType: 'aadhaar',
            status: 'completed'
        });
        
        if (!aadhaarVerification) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar verification record not found. Please complete Aadhaar OCR verification first.'
            });
        }
        
        // Check if Aadhaar number is present
        if (!aadhaarVerification.verificationDetails?.aadhaarNumber) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar number is missing in verification records. Please verify your Aadhaar again.'
            });
        }
        
        // Call SurePass API to generate OTP
        const apiResponse = await callSurepassAPI('aadhaar-v2/generate-otp', {
            id_number: aadhaarVerification.verificationDetails.aadhaarNumber
        }, 'POST');
        
        // Process API response
        if (apiResponse.success) {
            // Initialize OTP in verification record
            aadhaarVerification.otp = {
                sentAt: new Date(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                attempts: 0
            };
            aadhaarVerification.referenceId = apiResponse.data.client_id;
            aadhaarVerification.requestData = {
                id_number: aadhaarVerification.verificationDetails.aadhaarNumber
            };
            
            await aadhaarVerification.save();
            
            return res.status(200).json({
                success: true,
                message: 'OTP sent to registered mobile number',
                data: {
                    client_id: apiResponse.data.client_id
                }
            });
        } else {
            // Handle API error
            return res.status(400).json({
                success: false,
                message: 'Failed to generate OTP',
                error: apiResponse.error || 'OTP generation failed'
            });
        }
    } catch (error) {
        console.error('Error in generating Aadhaar OTP:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Verify Aadhaar OTP
 */
const verifyAadhaarOTP = async (req, res) => {
    try {
        // Get userId from request (from auth middleware)
        const userId = req.userId;
        
        // Get OTP from request body
        const { otp } = req.body;
        
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required'
            });
        }
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get Aadhaar verification record
        const aadhaarVerification = await Verification.findOne({ 
            userId, 
            verificationType: 'aadhaar',
            status: 'completed'
        });
        
        if (!aadhaarVerification) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar verification record not found. Please complete Aadhaar OCR verification first.'
            });
        }
        
        // Check if reference ID is present
        if (!aadhaarVerification.referenceId) {
            return res.status(400).json({
                success: false,
                message: 'Aadhaar client ID not found. Please generate OTP first.'
            });
        }
        
        // Check if OTP is expired
        if (aadhaarVerification.otp?.expiresAt && new Date() > aadhaarVerification.otp.expiresAt) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please generate a new OTP.'
            });
        }
        
        // Increment OTP attempts
        aadhaarVerification.otp.attempts = (aadhaarVerification.otp.attempts || 0) + 1;
        await aadhaarVerification.save();
        
        // Call SurePass API to verify OTP
        const apiResponse = await callSurepassAPI('aadhaar-v2/submit-otp', {
            client_id: aadhaarVerification.referenceId,
            otp
        }, 'POST');
        
        // Process API response
        if (apiResponse.success) {
            // Update user model to mark Aadhaar as validated
            user.isAadhaarValidated = true;
            await user.save();
            
            // Update verification record
            aadhaarVerification.otp.verifiedAt = new Date();
            aadhaarVerification.responseData = {
                ...aadhaarVerification.responseData,
                otpVerification: apiResponse.data
            };
            await aadhaarVerification.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: aadhaarVerification._id,
                description: 'Aadhaar OTP verification completed successfully',
                details: {
                    verificationType: 'aadhaar_otp',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'Aadhaar validated successfully',
                data: {
                    isAadhaarValidated: true
                }
            });
        } else {
            // Handle API error
            return res.status(400).json({
                success: false,
                message: 'Failed to verify OTP',
                error: apiResponse.error || 'OTP verification failed'
            });
        }
    } catch (error) {
        console.error('Error in verifying Aadhaar OTP:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Update bank account details
 */
const updateBankAccount = async (req, res) => {
    try {
        const userId = req.userId;
        const { accountNumber, ifscCode, bankName, accountHolderName } = req.body;
        
        // Validate required fields
        if (!accountNumber || !ifscCode || !accountHolderName) {
            return res.status(400).json({
                success: false,
                message: 'Account number, IFSC code, and account holder name are required'
            });
        }
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Find existing verification or create new one
        let verification = await Verification.findOne({
            userId,
            verificationType: 'bank_account'
        });
        
        if (!verification) {
            verification = new Verification({
                userId,
                verificationType: 'bank_account',
                mode: 'auto',
                provider: 'surepass',
                status: 'pending',
                verificationDetails: {
                    accountNumber,
                    ifscCode,
                    bankName: bankName || '',
                    accountHolderName
                }
            });
        } else {
            // Update existing verification
            verification.status = 'pending';
            verification.verificationDetails = {
                ...(verification.verificationDetails || {}),
                accountNumber,
                ifscCode,
                bankName: bankName || verification.verificationDetails?.bankName || '',
                accountHolderName
            };
        }
        
        await verification.save();
        
        res.status(200).json({
            success: true,
            message: 'Banking details updated successfully',
            data: {
                accountNumber: accountNumber,
                ifscCode: ifscCode,
                bankName: verification.verificationDetails.bankName,
                accountHolderName: accountHolderName,
                isVerified: false
            }
        });
    } catch (error) {
        console.error('Error updating banking details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Verify bank account using penny drop
 */
const verifyBankAccount = async (req, res) => {
    try {
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get banking details
        const verification = await Verification.findOne({
            userId,
            verificationType: 'bank_account'
        });
        
        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Banking details not found. Please add your banking details first.'
            });
        }
        
        // If already verified, return success
        if (verification.status === 'completed') {
            return res.status(200).json({
                success: true,
                message: 'Bank account already verified',
                data: {
                    isVerified: true,
                    accountHolderName: verification.verificationDetails.accountHolderName,
                    accountNumber: 'XXXXXXXX' + verification.verificationDetails.accountNumber.slice(-4),
                    ifscCode: verification.verificationDetails.ifscCode,
                    bankName: verification.verificationDetails.bankName
                }
            });
        }
        
        // Update verification status
        verification.status = 'in_progress';
        await verification.save();
        
        // Call SurePass API for penny drop verification
        const pennyDropData = {
            account_number: verification.verificationDetails.accountNumber,
            ifsc: verification.verificationDetails.ifscCode,
            name: verification.verificationDetails.accountHolderName,
            mobile: user.phone // Optional
        };
        
        const apiResponse = await callSurepassAPI('penny-drop/sync', pennyDropData, 'POST');
        
        // Process API response
        if (apiResponse.success) {
            // Update verification record
            verification.status = 'completed';
            verification.responseData = apiResponse.data;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: apiResponse.data
            });
            
            await verification.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: verification._id,
                description: 'Bank account verification completed successfully',
                details: {
                    verificationType: 'bank_account',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'Bank account verified successfully',
                data: {
                    isVerified: true,
                    accountHolderName: verification.verificationDetails.accountHolderName,
                    accountNumber: 'XXXXXXXX' + verification.verificationDetails.accountNumber.slice(-4),
                    ifscCode: verification.verificationDetails.ifscCode,
                    bankName: verification.verificationDetails.bankName
                }
            });
        } else {
            // Handle API error
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Failed to verify bank account',
                data: apiResponse
            });
            await verification.save();
            
            return res.status(400).json({
                success: false,
                message: 'Failed to verify bank account',
                error: apiResponse.error || 'Penny drop verification failed'
            });
        }
    } catch (error) {
        console.error('Error verifying bank account:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get verification status
 */
const getVerificationStatus = async (req, res) => {
    try {
        const userId = req.userId;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get all verifications for user
        const verifications = await Verification.find({ userId });
        
        // Organize by verification type
        const verificationStatus = {
            isAadhaarVerified: user.isAadhaarVerified,
            isAadhaarValidated: user.isAadhaarValidated,
            isPanVerified: user.isPanVerified,
            verifications: {}
        };
        
        // Process each verification
        for (const verification of verifications) {
            const { verificationType, status, completedAt, verificationDetails } = verification;
            
            // Prepare base info
            verificationStatus.verifications[verificationType] = {
                status,
                isVerified: status === 'completed',
                completedAt
            };
            
            // Add specific details based on verification type
            if (verificationType === 'aadhaar' && status === 'completed') {
                verificationStatus.verifications.aadhaar.aadhaarNumber = 
                    verificationDetails.aadhaarNumber ? 
                    verificationDetails.aadhaarNumber.substring(0, 4) + ' XXXX XXXX' : 
                    null;
                    
                verificationStatus.verifications.aadhaar.name = 
                    verificationDetails.aadhaarName;
            }
            
            if (verificationType === 'pan' && status === 'completed') {
                verificationStatus.verifications.pan.panNumber = 
                    verificationDetails.panNumber ? 
                    verificationDetails.panNumber.substring(0, 2) + 'XXXXX' + 
                    verificationDetails.panNumber.substring(7) : 
                    null;
                    
                verificationStatus.verifications.pan.name = 
                    verificationDetails.panName;
            }
            
            if (verificationType === 'bank_account') {
                if (status === 'completed') {
                    verificationStatus.verifications.bank_account.accountNumber = 
                        verificationDetails.accountNumber ? 
                        'XXXXXXXX' + verificationDetails.accountNumber.slice(-4) : 
                        null;
                        
                    verificationStatus.verifications.bank_account.ifscCode = 
                        verificationDetails.ifscCode;
                        
                    verificationStatus.verifications.bank_account.bankName = 
                        verificationDetails.bankName;
                        
                    verificationStatus.verifications.bank_account.accountHolderName = 
                        verificationDetails.accountHolderName;
                } else {
                    // For non-completed bank verifications, still include some details
                    verificationStatus.verifications.bank_account.accountHolderName = 
                        verificationDetails?.accountHolderName;
                        
                    verificationStatus.verifications.bank_account.ifscCode = 
                        verificationDetails?.ifscCode;
                }
            }
        }
        
        return res.status(200).json({
            success: true,
            message: 'Verification status retrieved successfully',
            data: verificationStatus
        });
    } catch (error) {
        console.error('Error getting verification status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Helper function to call SurePass API
 */
const callSurepassAPI = async (endpoint, data, method = 'POST') => {
    try {
        const apiKey = process.env.SUREPASS_API_KEY;
        const baseUrl = process.env.SUREPASS_API_URL || 'https://kyc-api.surepass.io/api/v1';
        
        const url = `${baseUrl}/${endpoint}`;
        
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
        
        let response;
        
        if (method === 'POST') {
            if (typeof data === 'object') {
                // Regular JSON POST
                response = await axios.post(url, data, { headers });
            } else {
                // Handling file upload POST (FormData)
                const formData = new FormData();
                formData.append('file', data);
                
                headers['Content-Type'] = 'multipart/form-data';
                response = await axios.post(url, formData, { headers });
            }
        } else if (method === 'GET') {
            response = await axios.get(url, { 
                headers,
                params: data
            });
        } else {
            throw new Error(`Unsupported method: ${method}`);
        }
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error(`Error calling SurePass API (${endpoint}):`, error.response?.data || error.message);
        
        return {
            success: false,
            error: error.response?.data?.error || error.message
        };
    }
};

// Export controller functions
module.exports = {
    aadhaarOCR,
    panVerification,
    aadhaarPanLink,
    generateAadhaarOTP,
    verifyAadhaarOTP,
    updateBankAccount,
    verifyBankAccount,
    getVerificationStatus
};