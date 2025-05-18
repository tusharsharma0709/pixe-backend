// services/kycWorkflowHandlers.js - Complete Implementation with Space Handling

const { User } = require('../models/Users');
const { UserSession } = require('../models/UserSessions');
const { Verification } = require('../models/Verifications');
const { ActivityLog } = require('../models/ActivityLogs');
const surepassServices = require('./surepassServices'); // Import the surepass services

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
 * @returns {String} - Formatted Aadhaar number without spaces
 */
const formatAadhaarNumber = (aadhaarNumber) => {
    if (!aadhaarNumber) return '';
    // Remove all non-digit characters (spaces, hyphens, etc.)
    return aadhaarNumber.replace(/\D/g, '');
};

/**
 * Format Aadhaar number for display with spaces
 * @param {String} aadhaarNumber - The raw Aadhaar number 
 * @returns {String} - Formatted Aadhaar number with spaces (1234 5678 9012)
 */
const formatAadhaarDisplay = (aadhaarNumber) => {
    if (!aadhaarNumber) return '';
    
    // First remove all non-digit characters
    const digitsOnly = aadhaarNumber.replace(/\D/g, '');
    
    // Then format with spaces every 4 digits if length is 12
    if (digitsOnly.length === 12) {
        return `${digitsOnly.substring(0, 4)} ${digitsOnly.substring(4, 8)} ${digitsOnly.substring(8, 12)}`;
    }
    
    // Otherwise return as is
    return digitsOnly;
};

/**
 * Format PAN number by removing spaces and converting to uppercase
 * @param {String} panNumber - The raw PAN number from user input
 * @returns {String} - Formatted PAN number (uppercase, no spaces)
 */
const formatPanNumber = (panNumber) => {
    if (!panNumber) return '';
    // Remove spaces and convert to uppercase
    return panNumber.replace(/\s+/g, '').toUpperCase();
};

/**
 * Helper function to mask Aadhaar number for logging
 */
const maskAadhaar = (aadhaarNumber) => {
    if (!aadhaarNumber || aadhaarNumber.length < 8) return 'invalid-number';
    
    // Get digits only
    const digitsOnly = aadhaarNumber.replace(/\D/g, '');
    
    if (digitsOnly.length === 12) {
        // Return formatted with spaces and masking
        return `${digitsOnly.substring(0, 4)} XXXX ${digitsOnly.substring(8, 12)}`;
    }
    
    // For other cases, just mask the middle part
    return `${digitsOnly.substring(0, 3)}...${digitsOnly.substring(digitsOnly.length - 3)}`;
};

/**
 * Verify Aadhaar number
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAadhaar(sessionId) {
    try {
        console.log(`\n🔍 Verifying Aadhaar for session ${sessionId}`);
        
        // Get session data
        const session = await UserSession.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (!session.data) {
            throw new Error('Session data is empty');
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
        
        console.log(`🔢 Raw Aadhaar input: "${rawAadhaarNumber}"`);
        
        // Store original format for display purposes (with spaces)
        const displayAadhaar = formatAadhaarDisplay(rawAadhaarNumber);
        // Get digits only for verification
        const aadhaarNumber = formatAadhaarNumber(rawAadhaarNumber);
        
        console.log(`🔢 Formatted Aadhaar: "${maskAadhaar(displayAadhaar)}"`);
        
        if (aadhaarNumber.length !== 12) {
            throw new Error(`Invalid Aadhaar number format: ${maskAadhaar(aadhaarNumber)}`);
        }
        
        // Get name from session or user data
        const name = session.data.full_name || user.name;
        
        // If running in test mode (no SurePass API), simulate verification
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful verification');
            
            // Create verification record
            const verification = new Verification({
                userId: session.userId,
                verificationType: 'aadhaar',
                mode: 'auto',
                provider: 'test',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                verificationDetails: {
                    aadhaarNumber,
                    aadhaarName: name || 'Test User',
                    nameMatch: {
                        status: true,
                        score: 100,
                        details: { matched: true, source: 'test_mode' }
                    }
                },
                responseData: {
                    success: true,
                    message: 'Test verification success',
                    verification_id: `test-${Date.now()}`
                },
                verificationAttempts: [{
                    attemptedAt: new Date(),
                    status: 'success',
                    data: { 
                        mode: 'test',
                        aadhaarNumber,
                        aadhaarName: name || 'Test User'
                    }
                }]
            });
            
            await verification.save();
            console.log('✅ Test verification record created');
            
            // Update user
            user.isAadhaarVerified = true;
            await user.save();
            console.log('✅ User record updated with isAadhaarVerified = true');
            
            return {
                success: true,
                message: 'Aadhaar verified successfully (TEST MODE)',
                aadhaarName: name || 'Test User'
            };
        }
        
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
                    aadhaarNumber,
                    nameMatch: {
                        status: null,
                        score: null,
                        details: {}
                    }
                }
            });
        } else {
            verification.status = 'in_progress';
            verification.verificationDetails = {
                ...verification.verificationDetails,
                aadhaarNumber,
                nameMatch: verification.verificationDetails.nameMatch || {
                    status: null,
                    score: null,
                    details: {}
                }
            };
        }
        
        await verification.save();
        console.log(`✅ Verification record created/updated with ID: ${verification._id}`);
        
        // Call SurePass API to verify Aadhaar
        console.log(`📡 Calling SurePass API to verify Aadhaar number`);
        const result = await surepassServices.verifyAadhaar(aadhaarNumber, 'Y');
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        
        // Process verification result
        if (result && result.success) {
            // Extract verification data
            const aadhaarName = result.data?.name_on_card || result.data?.name || null;
            console.log(`👤 Extracted name from Aadhaar: ${aadhaarName || 'Not available'}`);
            
            // Check name match if name is available
            const namesMatch = !name || !aadhaarName || doNamesMatch(name, aadhaarName);
            console.log(`🔍 Name match check: ${namesMatch ? 'PASSED' : 'FAILED'}`);
            
            if (!namesMatch) {
                // Name mismatch
                verification.status = 'failed';
                verification.verificationDetails.nameMatch = {
                    status: false,
                    score: 0,
                    details: {
                        providedName: name,
                        aadhaarName: aadhaarName,
                        reason: 'Name mismatch'
                    }
                };
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
                aadhaarName,
                nameMatch: {
                    status: true,
                    score: 100,
                    details: { matched: true }
                }
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
            console.log(`✅ Verification record updated to COMPLETED status`);
            
            // Update user verification status
            user.isAadhaarVerified = true;
            await user.save();
            console.log(`✅ User record updated with isAadhaarVerified = true`);
            
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
            verification.verificationDetails.nameMatch = {
                status: false,
                score: 0,
                details: { 
                    reason: result?.error || 'Verification failed',
                    apiError: result?.error || 'Unknown error'
                }
            };
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: result?.error || 'Verification failed',
                data: result
            });
            await verification.save();
            console.log(`❌ Verification failed: ${result?.error || 'Unknown error'}`);
            
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
        console.log(`\n🔍 Verifying PAN for session ${sessionId}`);
        
        // Get session data
        const session = await UserSession.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (!session.data) {
            throw new Error('Session data is empty');
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
        
        console.log(`🔢 Raw PAN input: "${rawPanNumber}"`);
        const panNumber = formatPanNumber(rawPanNumber);
        console.log(`🔢 Formatted PAN: "${panNumber}"`);
        
        if (panNumber.length !== 10) {
            throw new Error(`Invalid PAN number format: ${panNumber}`);
        }
        
        // Get name from session or user data
        const name = session.data.full_name || user.name;
        
        // If running in test mode (no SurePass API), simulate verification
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful verification');
            
            // Create verification record
            const verification = new Verification({
                userId: session.userId,
                verificationType: 'pan',
                mode: 'auto',
                provider: 'test',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                verificationDetails: {
                    panNumber,
                    panName: name || 'Test User',
                    nameMatch: {
                        status: true,
                        score: 100,
                        details: { matched: true, source: 'test_mode' }
                    }
                },
                responseData: {
                    success: true,
                    message: 'Test verification success',
                    verification_id: `test-${Date.now()}`
                },
                verificationAttempts: [{
                    attemptedAt: new Date(),
                    status: 'success',
                    data: { 
                        mode: 'test',
                        panNumber,
                        panName: name || 'Test User'
                    }
                }]
            });
            
            await verification.save();
            console.log('✅ Test verification record created');
            
            // Update user
            user.isPanVerified = true;
            await user.save();
            console.log('✅ User record updated with isPanVerified = true');
            
            return {
                success: true,
                message: 'PAN verified successfully (TEST MODE)',
                panName: name || 'Test User'
            };
        }
        
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
                    panNumber,
                    nameMatch: {
                        status: null,
                        score: null,
                        details: {}
                    }
                }
            });
        } else {
            verification.status = 'in_progress';
            verification.verificationDetails = {
                ...verification.verificationDetails,
                panNumber,
                nameMatch: verification.verificationDetails.nameMatch || {
                    status: null,
                    score: null,
                    details: {}
                }
            };
        }
        
        await verification.save();
        console.log(`✅ Verification record created/updated with ID: ${verification._id}`);
        
        // Call SurePass API to verify PAN
        console.log(`📡 Calling SurePass API to verify PAN number`);
        const result = await surepassServices.verifyPAN(panNumber, 'Y');
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        
        // Process verification result
        if (result && result.success) {
            // Extract verification data
            const panName = result.data?.name_on_card || result.data?.name || null;
            console.log(`👤 Extracted name from PAN: ${panName || 'Not available'}`);
            
            // Check name match if name is available
            const namesMatch = !name || !panName || doNamesMatch(name, panName);
            console.log(`🔍 Name match check: ${namesMatch ? 'PASSED' : 'FAILED'}`);
            
            if (!namesMatch) {
                // Name mismatch
                verification.status = 'failed';
                verification.verificationDetails.nameMatch = {
                    status: false,
                    score: 0,
                    details: {
                        providedName: name,
                        panName: panName,
                        reason: 'Name mismatch'
                    }
                };
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
                panName,
                nameMatch: {
                    status: true,
                    score: 100,
                    details: { matched: true }
                }
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
            console.log(`✅ Verification record updated to COMPLETED status`);
            
            // Update user verification status
            user.isPanVerified = true;
            await user.save();
            console.log(`✅ User record updated with isPanVerified = true`);
            
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
            verification.verificationDetails.nameMatch = {
                status: false,
                score: 0,
                details: { 
                    reason: result?.error || 'Verification failed',
                    apiError: result?.error || 'Unknown error'
                }
            };
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'failure',
                reason: result?.error || 'Verification failed',
                data: result
            });
            await verification.save();
            console.log(`❌ Verification failed: ${result?.error || 'Unknown error'}`);
            
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
        console.log(`\n🔍 Checking Aadhaar-PAN link for session ${sessionId}`);
        
        // Get session
        const session = await UserSession.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (!session.data) {
            throw new Error('Session data is empty');
        }
        
        // Get user
        const user = await User.findById(session.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Get Aadhaar and PAN numbers from session data
        const rawAadhaarNumber = session.data.aadhaar_number;
        const rawPanNumber = session.data.pan_number;
        
        if (!rawAadhaarNumber) {
            throw new Error('Aadhaar number not found in session data');
        }
        
        if (!rawPanNumber) {
            throw new Error('PAN number not found in session data');
        }
        
        // Format numbers for API call (remove spaces, special characters)
        const aadhaarNumber = formatAadhaarNumber(rawAadhaarNumber);
        const panNumber = formatPanNumber(rawPanNumber);
        
        console.log(`🔢 Formatted Aadhaar: "${maskAadhaar(aadhaarNumber)}"`);
        console.log(`🔢 Formatted PAN: "${panNumber}"`);
        
        if (aadhaarNumber.length !== 12) {
            throw new Error(`Invalid Aadhaar number format: ${maskAadhaar(aadhaarNumber)}`);
        }
        
        if (panNumber.length !== 10) {
            throw new Error(`Invalid PAN number format: ${panNumber}`);
        }
        
        // If running in test mode (no SurePass API), simulate verification
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful verification');
            
            // Create verification record
            const verification = new Verification({
                userId: session.userId,
                verificationType: 'aadhaar_pan_link',
                mode: 'auto',
                provider: 'test',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                responseData: {
                    success: true,
                    message: 'Test verification success',
                    link_status: 'Y',
                    verification_id: `test-${Date.now()}`
                },
                verificationAttempts: [{
                    attemptedAt: new Date(),
                    status: 'success',
                    data: { 
                        mode: 'test',
                        isLinked: true
                    }
                }]
            });
            
            await verification.save();
            console.log('✅ Test verification record created');
            
            return {
                success: true,
                message: 'Aadhaar and PAN are linked (TEST MODE)',
                isLinked: true
            };
        }
        
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
        console.log(`✅ Verification record created/updated with ID: ${linkVerification._id}`);
        
        // Call SurePass API to check if Aadhaar and PAN are linked
        console.log(`📡 Calling SurePass API to check Aadhaar-PAN link`);
        
        // IMPORTANT: Check actual request and response from logs
        // Based on logs, the API is at /pan/aadhaar-pan-link-check
        // And parameters are aadhaar_number and consent: panNumber
        const result = await surepassServices.checkAadhaarPANLink(aadhaarNumber, panNumber);
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`📡 Full API response: ${JSON.stringify(result.data, null, 2)}`);
        
        // Process API response
        if (result && result.success) {
            // IMPORTANT FIX: Check the correct location of linking_status based on API response
            // From logs, the structure is: result.data.data.linking_status
            
            // Define isLinked with a proper default
            let isLinked = false;
            
            // Check all possible paths where linking status might be found
            if (result.data) {
                // Direct linking_status property
                if (typeof result.data.linking_status === 'boolean') {
                    isLinked = result.data.linking_status;
                } 
                // Check if it's in the data.data object
                else if (result.data.data && typeof result.data.data.linking_status === 'boolean') {
                    isLinked = result.data.data.linking_status;
                }
                // Check for "reason": "linked" at different levels
                else if (result.data.reason === 'linked') {
                    isLinked = true;
                }
                else if (result.data.data && result.data.data.reason === 'linked') {
                    isLinked = true;
                }
                // Check for link_status if present
                else if (result.data.link_status === 'Y' || result.data.link_status === true) {
                    isLinked = true;
                }
                else if (result.data.data && (result.data.data.link_status === 'Y' || result.data.data.link_status === true)) {
                    isLinked = true;
                }
            }
            
            // CRITICAL: Double-check the response from the logs
            // The API returns { "linking_status": true, "reason": "linked" }
            // So make sure we check for those specific values
            const responseData = result.data;
            if (responseData && responseData.data) {
                if (responseData.data.linking_status === true && responseData.data.reason === 'linked') {
                    console.log(`⭐ Found explicit 'linking_status: true' and 'reason: linked' in the API response`);
                    isLinked = true;
                }
            }
            
            console.log(`🔗 Link status determined to be: ${isLinked ? 'LINKED' : 'NOT LINKED'}`);
            
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
            console.log(`✅ Verification record updated to COMPLETED status`);
            
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
                    verificationMode: 'auto',
                    isLinked
                },
                status: 'success'
            });
            
            return {
                success: true,
                message: isLinked ? 'Aadhaar and PAN are linked' : 'Aadhaar and PAN are not linked',
                isLinked: isLinked,
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
            console.log(`❌ Verification failed: ${result?.error || 'Unknown error'}`);
            
            return {
                success: false,
                message: result?.error || 'Failed to check Aadhaar-PAN link',
                isLinked: false
            };
        }
    } catch (error) {
        console.error('Error checking Aadhaar-PAN link:', error);
        return {
            success: false,
            message: error.message || 'Error checking Aadhaar-PAN link',
            isLinked: false
        };
    }
}

module.exports = {
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPanLink,
    // Also export helper functions for testing
    formatAadhaarNumber,
    formatAadhaarDisplay,
    formatPanNumber,
    doNamesMatch,
    maskAadhaar
};