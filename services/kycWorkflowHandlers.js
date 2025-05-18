// services/kycWorkflowHandlers.js
const { User } = require('../models/Users');
const { UserSession } = require('../models/UserSessions');
const { Message } = require('../models/Messages');
const { FileUpload } = require('../models/FileUploads');
const { Verification } = require('../models/Verifications');
const { ActivityLog } = require('../models/ActivityLogs');
const surepassServices = require('./surepassServices');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

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
 * Extracts the WhatsApp media URL from a message in a session
 * @param {String} sessionId - The session ID
 * @param {String} variableName - The variable containing the media message
 * @returns {Promise<Object>} - Media information 
 */
async function extractMediaFromMessage(sessionId, variableName) {
    try {
        console.log(`Extracting media for session ${sessionId}, variable ${variableName}`);
        
        // Get the session
        const session = await UserSession.findById(sessionId);
        if (!session || !session.data || !session.data[variableName]) {
            console.error(`No message data found for variable ${variableName}`);
            throw new Error('Message data not found');
        }
        
        // Get the most recent message in the session
        const message = await Message.findOne({
            sessionId,
            sender: 'user',
            createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        }).sort({ createdAt: -1 });
        
        if (!message) {
            console.error('No recent message found for media extraction');
            throw new Error('No recent message found');
        }
        
        console.log(`Found message: ${message._id}, type: ${message.messageType}`);
        
        // If message doesn't have media, throw error
        if (!message.mediaUrl || message.messageType === 'text') {
            console.error('Message does not contain media');
            throw new Error('No media found in message');
        }
        
        // Return media info
        return {
            url: message.mediaUrl,
            type: message.messageType,
            name: message.mediaName || `${message.messageType}_${Date.now()}`,
            size: message.mediaSize || 0,
            messageId: message._id
        };
    } catch (error) {
        console.error('Error extracting media from message:', error);
        throw error;
    }
}

/**
 * Downloads media from a URL
 * @param {String} url - Media URL
 * @returns {Promise<Buffer>} - Media buffer
 */
async function downloadMedia(url) {
    try {
        console.log(`Downloading media from URL: ${url}`);
        
        // Get WhatsApp API token from env
        const token = process.env.WHATSAPP_API_TOKEN;
        
        // Download the media
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'arraybuffer'
        });
        
        console.log(`Downloaded media: ${response.data.byteLength} bytes`);
        
        return response.data;
    } catch (error) {
        console.error('Error downloading media:', error);
        throw error;
    }
}

/**
 * Store media as a file upload
 * @param {Buffer} buffer - Media buffer
 * @param {Object} mediaInfo - Media information
 * @param {String} userId - User ID
 * @param {String} entityType - Entity type (e.g., 'verification') 
 * @returns {Promise<Object>} - File upload record
 */
async function storeMedia(buffer, mediaInfo, userId, entityType = 'verification') {
    try {
        console.log(`Storing media for user ${userId}`);
        
        // Get admin and firebase from uploaded file controllers
        const admin = require('firebase-admin');
        
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
        
        // Generate unique filename
        const fileExt = path.extname(mediaInfo.name) || '.jpg';
        const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
        const filePath = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${filename}`;
        
        // Determine MIME type
        let mimeType;
        switch (mediaInfo.type) {
            case 'image':
                mimeType = 'image/jpeg';
                break;
            case 'document':
                mimeType = 'application/pdf';
                break;
            default:
                mimeType = 'application/octet-stream';
        }
        
        // Create a file in Firebase Storage
        const fileRef = bucket.file(filePath);
        
        // Upload file to Firebase Storage
        await fileRef.save(buffer, {
            metadata: {
                contentType: mimeType,
                originalName: mediaInfo.name
            },
            public: false,
            resumable: false
        });
        
        // Generate signed URL for the file
        const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        // Create file upload record
        const fileUpload = new FileUpload({
            filename,
            originalFilename: mediaInfo.name,
            path: filePath,
            url: signedUrl,
            mimeType,
            size: buffer.length,
            uploadedBy: {
                id: userId,
                role: 'user'
            },
            userId,
            entityType,
            status: 'permanent',
            isPublic: false,
            bucket: bucket.name,
            storageProvider: 'google_cloud',
            storageMetadata: {
                firebasePath: filePath
            },
            isScanRequired: true
        });
        
        await fileUpload.save();
        console.log(`File upload created: ${fileUpload._id}`);
        
        return fileUpload;
    } catch (error) {
        console.error('Error storing media:', error);
        throw error;
    }
}

/**
 * Processes Aadhaar OCR for a user session
 * @param {String} sessionId - The user session ID
 * @returns {Promise<Object>} - Verification result
 */
async function processAadhaarOCR(sessionId) {
    try {
        console.log(`Processing Aadhaar OCR for session ${sessionId}`);
        
        // Get session
        const session = await UserSession.findById(sessionId).populate('userId');
        if (!session) {
            throw new Error('Session not found');
        }
        
        // Extract the media URLs from the messages
        const frontMedia = await extractMediaFromMessage(sessionId, 'aadhaar_front_message');
        const backMedia = await extractMediaFromMessage(sessionId, 'aadhaar_back_message');
        
        console.log('Front media URL:', frontMedia.url);
        console.log('Back media URL:', backMedia.url);
        
        // Download the media
        const frontBuffer = await downloadMedia(frontMedia.url);
        const backBuffer = await downloadMedia(backMedia.url);
        
        // Store the media
        const frontFile = await storeMedia(frontBuffer, frontMedia, session.userId, 'verification');
        const backFile = await storeMedia(backBuffer, backMedia, session.userId, 'verification');
        
        // Process with SurePass OCR
        const frontOcrResult = await surepassServices.processAadhaarOCR(frontBuffer);
        const backOcrResult = await surepassServices.processAadhaarOCR(backBuffer);
        
        console.log('Front OCR result:', JSON.stringify(frontOcrResult));
        console.log('Back OCR result:', JSON.stringify(backOcrResult));
        
        // Extract Aadhaar number and name
        let aadhaarNumber = null;
        let aadhaarName = null;
        
        if (frontOcrResult && 
            frontOcrResult.ocr_fields && 
            frontOcrResult.ocr_fields.length > 0) {
            
            const fields = frontOcrResult.ocr_fields[0];
            
            if (fields.aadhaar_number) {
                aadhaarNumber = fields.aadhaar_number.value;
            }
            
            if (fields.full_name) {
                aadhaarName = fields.full_name.value;
            }
        }
        
        // Check name match with submitted name
        const dbName = session.data.full_name || '';
        const namesMatch = !dbName || doNamesMatch(dbName, aadhaarName);
        
        // Get user
        const user = await User.findById(session.userId);
        
        // Create verification record
        let verification = await Verification.findOne({
            userId: session.userId,
            verificationType: 'aadhaar'
        });
        
        if (!verification) {
            verification = new Verification({
                userId: session.userId,
                verificationType: 'aadhaar',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress',
                documents: [
                    {
                        type: 'aadhaar_front',
                        url: frontFile.url,
                        status: 'pending'
                    },
                    {
                        type: 'aadhaar_back',
                        url: backFile.url,
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
                    url: frontFile.url,
                    status: 'pending'
                },
                {
                    type: 'aadhaar_back',
                    url: backFile.url,
                    status: 'pending'
                }
            );
        }
        
        // Process verification results
        if (aadhaarNumber && aadhaarName) {
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
            verification.responseData = {
                front: frontOcrResult,
                back: backOcrResult
            };
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    aadhaarNumber,
                    aadhaarName
                }
            });
            
            // Update document status
            verification.documents.forEach(doc => {
                if (doc.type === 'aadhaar_front' || doc.type === 'aadhaar_back') {
                    doc.status = 'approved';
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isAadhaarVerified = true;
            await user.save();
            
            // Update session data
            session.data.isAadhaarVerified = true;
            session.data.aadhaarName = aadhaarName;
            session.data.aadhaarNumber = aadhaarNumber;
            session.markModified('data');
            await session.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: user._id,
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
            
            // Return success
            return {
                success: true,
                aadhaarName,
                aadhaarNumber: aadhaarNumber ? aadhaarNumber.substring(0, 4) + ' XXXX XXXX' : null,
                isVerified: true
            };
        } else {
            // Handle verification failure
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Could not extract Aadhaar details from images'
            });
            await verification.save();
            
            // Update session data
            session.data.isAadhaarVerified = false;
            session.markModified('data');
            await session.save();
            
            return {
                success: false,
                message: 'Could not extract Aadhaar details from images'
            };
        }
    } catch (error) {
        console.error('Error processing Aadhaar OCR:', error);
        return {
            success: false,
            message: error.message || 'Error processing Aadhaar OCR'
        };
    }
}

/**
 * Processes PAN OCR for a user session
 * @param {String} sessionId - The user session ID
 * @returns {Promise<Object>} - Verification result
 */
async function processPanOCR(sessionId) {
    try {
        console.log(`Processing PAN OCR for session ${sessionId}`);
        
        // Get session
        const session = await UserSession.findById(sessionId).populate('userId');
        if (!session) {
            throw new Error('Session not found');
        }
        
        // Get user
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Check if Aadhaar is verified first
        if (!user.isAadhaarVerified) {
            throw new Error('Aadhaar verification must be completed first');
        }
        
        // Extract the media URL from the message
        const panMedia = await extractMediaFromMessage(sessionId, 'pan_message');
        console.log('PAN media URL:', panMedia.url);
        
        // Download the media
        const panBuffer = await downloadMedia(panMedia.url);
        
        // Store the media
        const panFile = await storeMedia(panBuffer, panMedia, session.userId, 'verification');
        
        // Process with SurePass OCR
        const panOcrResult = await surepassServices.processPANOCR(panBuffer);
        console.log('PAN OCR result:', JSON.stringify(panOcrResult));
        
        // Extract PAN number and name
        let panNumber = null;
        let panName = null;
        
        if (panOcrResult && 
            panOcrResult.ocr_fields && 
            panOcrResult.ocr_fields.length > 0) {
            
            const fields = panOcrResult.ocr_fields[0];
            
            if (fields.pan_number) {
                panNumber = fields.pan_number.value;
            }
            
            if (fields.full_name) {
                panName = fields.full_name.value;
            }
        }
        
        // Check name match with submitted name
        const dbName = session.data.full_name || user.name || '';
        const namesMatch = !dbName || doNamesMatch(dbName, panName);
        
        // Create verification record
        let verification = await Verification.findOne({
            userId: session.userId,
            verificationType: 'pan'
        });
        
        if (!verification) {
            verification = new Verification({
                userId: session.userId,
                verificationType: 'pan',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress',
                documents: [
                    {
                        type: 'pan',
                        url: panFile.url,
                        status: 'pending'
                    }
                ]
            });
        } else {
            // Update existing verification
            verification.status = 'in_progress';
            verification.documents.push({
                type: 'pan',
                url: panFile.url,
                status: 'pending'
            });
        }
        
        // Process verification results
        if (panNumber && panName) {
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
            verification.responseData = panOcrResult;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    panNumber,
                    panName
                }
            });
            
            // Update document status
            verification.documents.forEach(doc => {
                if (doc.type === 'pan') {
                    doc.status = 'approved';
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isPanVerified = true;
            await user.save();
            
            // Update session data
            session.data.isPanVerified = true;
            session.data.panName = panName;
            session.data.panNumber = panNumber;
            session.markModified('data');
            await session.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: user._id,
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
            
            // Return success
            return {
                success: true,
                panName,
                panNumber: panNumber ? panNumber.substring(0, 2) + 'XXXXX' + panNumber.substring(7) : null,
                isVerified: true
            };
        } else {
            // Handle verification failure
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Could not extract PAN details from image'
            });
            await verification.save();
            
            // Update session data
            session.data.isPanVerified = false;
            session.markModified('data');
            await session.save();
            
            return {
                success: false,
                message: 'Could not extract PAN details from image'
            };
        }
    } catch (error) {
        console.error('Error processing PAN OCR:', error);
        return {
            success: false,
            message: error.message || 'Error processing PAN OCR'
        };
    }
}

/**
 * Checks if Aadhaar and PAN are linked
 * @param {String} sessionId - The user session ID
 * @returns {Promise<Object>} - Verification result
 */
async function checkAadhaarPanLink(sessionId) {
    try {
        console.log(`Checking Aadhaar-PAN link for session ${sessionId}`);
        
        // Get session
        const session = await UserSession.findById(sessionId).populate('userId');
        if (!session) {
            throw new Error('Session not found');
        }
        
        // Get user
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Check if Aadhaar and PAN are verified
        if (!user.isAadhaarVerified) {
            throw new Error('Aadhaar verification must be completed first');
        }
        
        if (!user.isPanVerified) {
            throw new Error('PAN verification must be completed first');
        }
        
        // Get verification records
        const aadhaarVerification = await Verification.findOne({ 
            userId: user._id, 
            verificationType: 'aadhaar',
            status: 'completed'
        });
        
        const panVerification = await Verification.findOne({ 
            userId: user._id, 
            verificationType: 'pan',
            status: 'completed'
        });
        
        if (!aadhaarVerification || !panVerification) {
            throw new Error('Verification records not found');
        }
        
        // Check if Aadhaar number and PAN number are present
        if (!aadhaarVerification.verificationDetails?.aadhaarNumber) {
            throw new Error('Aadhaar number is missing in verification records');
        }
        
        if (!panVerification.verificationDetails?.panNumber) {
            throw new Error('PAN number is missing in verification records');
        }
        
        // Create a new verification record for Aadhaar-PAN link
        let linkVerification = await Verification.findOne({ 
            userId: user._id, 
            verificationType: 'aadhaar_pan_link'
        });
        
        if (!linkVerification) {
            linkVerification = new Verification({
                userId: user._id,
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
        const result = await surepassServices.checkAadhaarPANLink(
            aadhaarVerification.verificationDetails.aadhaarNumber,
            panVerification.verificationDetails.panNumber,
            'Y'
        );
        
        // Process API response
        if (result && result.data && result.data.link_status) {
            // Update verification with successful results
            linkVerification.status = 'completed';
            linkVerification.responseData = result.data;
            linkVerification.completedAt = new Date();
            linkVerification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: result.data
            });
            
            await linkVerification.save();
            
            // Update session data
            session.data.isAadhaarPanLinked = true;
            session.markModified('data');
            await session.save();
            
            // Create activity log
            await ActivityLog.create({
                actorId: user._id,
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
            
            return {
                success: true,
                message: 'Aadhaar and PAN are linked',
                isLinked: true,
                data: result.data
            };
        } else {
            // Handle API error
            linkVerification.status = 'failed';
            linkVerification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: 'Failed to check Aadhaar-PAN link',
                data: result
            });
            await linkVerification.save();
            
            // Update session data
            session.data.isAadhaarPanLinked = false;
            session.markModified('data');
            await session.save();
            
            return {
                success: false,
                message: 'Aadhaar and PAN are not linked',
                isLinked: false
            };
        }
    } catch (error) {
        console.error('Error checking Aadhaar-PAN link:', error);
        return {
            success: false,
            message: error.message || 'Error checking Aadhaar-PAN link'
        };
    }
}

module.exports = {
    processAadhaarOCR,
    processPanOCR,
    checkAadhaarPanLink
};