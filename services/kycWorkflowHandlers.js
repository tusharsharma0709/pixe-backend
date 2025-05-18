// services/kycWorkflowHandlers.js - Simplified for direct Aadhaar and PAN verification

const { User } = require('../models/Users');
const { UserSession } = require('../models/UserSessions');
const { Verification } = require('../models/Verifications');
const { ActivityLog } = require('../models/ActivityLogs');
const surepassServices = require('./surepassServices');

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
 * Format Aadhaar number by removing spaces and other characters
 * @param {String} aadhaarNumber - The raw Aadhaar number from user input
 * @returns {String} - Formatted Aadhaar number
 */
const formatAadhaarNumber = (aadhaarNumber) => {
    if (!aadhaarNumber) return '';
    // Remove all non-digit characters
    return aadhaarNumber.replace(/\D/g, '');
};

/**
 * Format PAN number by removing spaces and converting to uppercase
 * @param {String} panNumber - The raw PAN number from user input
 * @returns {String} - Formatted PAN number
 */
const formatPanNumber = (panNumber) => {
    if (!panNumber) return '';
    // Remove spaces and convert to uppercase
    return panNumber.replace(/\s+/g, '').toUpperCase();
};

/**
 * Verify Aadhaar number
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAadhaar(sessionId) {
    try {
        console.log(`Verifying Aadhaar for session ${sessionId}`);
        
        // Get session data
        const session = await UserSession.findById(sessionId);
        if (!session || !session.data) {
            throw new Error('Session or session data not found');
        }
        
        // Get user info
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Get Aadhaar number from session data and format it
        const rawAadhaarNumber = session.data.aadhaar_number;
        if (!rawAadhaarNumber) {
            throw new Error('Aadhaar number not found in session data');
        }
        
        const aadhaarNumber = formatAadhaarNumber(rawAadhaarNumber);
        if (aadhaarNumber.length !== 12) {
            throw new Error('Invalid Aadhaar number format');
        }
        
        // Get name from session or user data
        const name = session.data.full_name || user.name;
        
        // Create or update verification record
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
                verificationDetails: {
                    aadhaarNumber
                }
            });
        } else {
            verification.status = 'in_progress';
            verification.verificationDetails = {
                ...(verification.verificationDetails || {}),
                aadhaarNumber
            };
        }
        
        await verification.save();
        
        // Call SurePass API to verify Aadhaar
        const result = await surepassServices.verifyAadhaar(aadhaarNumber, 'Y');
        console.log('Aadhaar verification API result:', result);
        
        // Process verification result
        if (result && result.success) {
            // Extract verification data
            const aadhaarName = result.data?.name_on_card || result.data?.name;
            
            // Check name match if name is available
            const namesMatch = !name || !aadhaarName || doNamesMatch(name, aadhaarName);
            
            if (!namesMatch) {
                // Name mismatch
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Name mismatch',
                    data: {
                        providedName: name,
                        aadhaarName
                    }
                });
                await verification.save();
                
                return {
                    success: false,
                    message: 'The name provided does not match the name registered with this Aadhaar number'
                };
            }
            
            // Update verification record with success
            verification.status = 'completed';
            verification.verificationDetails = {
                ...verification.verificationDetails,
                aadhaarName
            };
            verification.responseData = result.data;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    aadhaarNumber,
                    aadhaarName
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isAadhaarVerified = true;
            await user.save();
            
            // Update session data
            session.data.isAadhaarVerified = true;
            session.data.aadhaarName = aadhaarName;
            session.markModified('data');
            await session.save();
            
            // Log activity
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
                message: 'Aadhaar number verified successfully',
                aadhaarName
            };
        } else {
            // Handle failed verification
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: result?.error || 'Verification failed',
                data: result
            });
            await verification.save();
            
            // Update session data
            session.data.isAadhaarVerified = false;
            session.markModified('data');
            await session.save();
            
            return {
                success: false,
                message: result?.error || 'Aadhaar verification failed'
            };
        }
    } catch (error) {
        console.error('Error verifying Aadhaar:', error);
        return {
            success: false,
            message: error.message || 'Error verifying Aadhaar'
        };
    }
}

/**
 * Verify PAN number
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - Verification result
 */
async function verifyPAN(sessionId) {
    try {
        console.log(`Verifying PAN for session ${sessionId}`);
        
        // Get session data
        const session = await UserSession.findById(sessionId);
        if (!session || !session.data) {
            throw new Error('Session or session data not found');
        }
        
        // Get user info
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Get PAN number from session data and format it
        const rawPanNumber = session.data.pan_number;
        if (!rawPanNumber) {
            throw new Error('PAN number not found in session data');
        }
        
        const panNumber = formatPanNumber(rawPanNumber);
        if (panNumber.length !== 10) {
            throw new Error('Invalid PAN number format');
        }
        
        // Get name from session or user data
        const name = session.data.full_name || user.name;
        
        // Create or update verification record
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
                verificationDetails: {
                    panNumber
                }
            });
        } else {
            verification.status = 'in_progress';
            verification.verificationDetails = {
                ...(verification.verificationDetails || {}),
                panNumber
            };
        }
        
        await verification.save();
        
        // Call SurePass API to verify PAN
        const result = await surepassServices.verifyPAN(panNumber, 'Y');
        console.log('PAN verification API result:', result);
        
        // Process verification result
        if (result && result.success) {
            // Extract verification data
            const panName = result.data?.name_on_card || result.data?.name;
            
            // Check name match if name is available
            const namesMatch = !name || !panName || doNamesMatch(name, panName);
            
            if (!namesMatch) {
                // Name mismatch
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Name mismatch',
                    data: {
                        providedName: name,
                        panName
                    }
                });
                await verification.save();
                
                return {
                    success: false,
                    message: 'The name provided does not match the name registered with this PAN'
                };
            }
            
            // Update verification record with success
            verification.status = 'completed';
            verification.verificationDetails = {
                ...verification.verificationDetails,
                panName
            };
            verification.responseData = result.data;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: {
                    panNumber,
                    panName
                }
            });
            
            await verification.save();
            
            // Update user verification status
            user.isPanVerified = true;
            await user.save();
            
            // Update session data
            session.data.isPanVerified = true;
            session.data.panName = panName;
            session.markModified('data');
            await session.save();
            
            // Log activity
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
                message: 'PAN verified successfully',
                panName
            };
        } else {
            // Handle failed verification
            verification.status = 'failed';
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: result?.error || 'Verification failed',
                data: result
            });
            await verification.save();
            
            // Update session data
            session.data.isPanVerified = false;
            session.markModified('data');
            await session.save();
            
            return {
                success: false,
                message: result?.error || 'PAN verification failed'
            };
        }
    } catch (error) {
        console.error('Error verifying PAN:', error);
        return {
            success: false,
            message: error.message || 'Error verifying PAN'
        };
    }
}

/**
 * Check if Aadhaar and PAN are linked
 * @param {String} sessionId - The user session ID
 * @returns {Promise<Object>} - Verification result
 */
async function checkAadhaarPanLink(sessionId) {
    try {
        console.log(`Checking Aadhaar-PAN link for session ${sessionId}`);
        
        // Get session
        const session = await UserSession.findById(sessionId);
        if (!session || !session.data) {
            throw new Error('Session or session data not found');
        }
        
        // Get user
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Get Aadhaar and PAN numbers from session data
        const rawAadhaarNumber = session.data.aadhaar_number;
        const rawPanNumber = session.data.pan_number;
        
        if (!rawAadhaarNumber || !rawPanNumber) {
            throw new Error('Aadhaar or PAN number not found in session data');
        }
        
        const aadhaarNumber = formatAadhaarNumber(rawAadhaarNumber);
        const panNumber = formatPanNumber(rawPanNumber);
        
        // Create or update verification record for Aadhaar-PAN link
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
        const result = await surepassServices.checkAadhaarPANLink(aadhaarNumber, panNumber, 'Y');
        console.log('Aadhaar-PAN Link API result:', result);
        
        // Process API response
        if (result && result.success && result.data && result.data.link_status) {
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
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPanLink
};