// services/kycWorkflowHandlers.js - Complete Implementation with All KYC Verification Methods

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
 * Format bank account number by removing spaces and other characters
 * @param {String} accountNumber - Raw bank account number
 * @returns {String} - Formatted account number
 */
const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    // Remove all non-digit characters
    return accountNumber.replace(/\D/g, '');
};

/**
 * Format IFSC code by removing spaces and converting to uppercase
 * @param {String} ifscCode - Raw IFSC code
 * @returns {String} - Formatted IFSC code
 */
const formatIfscCode = (ifscCode) => {
    if (!ifscCode) return '';
    // Remove spaces and convert to uppercase
    return ifscCode.replace(/\s+/g, '').toUpperCase();
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
 * Helper function to mask bank account number for logging
 */
const maskAccountNumber = (accountNumber) => {
    if (!accountNumber || accountNumber.length < 8) return 'invalid-number';
    
    // Get digits only
    const digitsOnly = accountNumber.replace(/\D/g, '');
    
    if (digitsOnly.length >= 8) {
        // Mask all but first 2 and last 4 digits
        return `${digitsOnly.substring(0, 2)}XXXX${digitsOnly.substring(digitsOnly.length - 4)}`;
    }
    
    // For shorter numbers, just mask the middle
    return `${digitsOnly.substring(0, 2)}...${digitsOnly.substring(digitsOnly.length - 2)}`;
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
 * Generate OTP for Aadhaar verification
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - OTP generation result
 */
async function generateAadhaarOTP(sessionId) {
    try {
        console.log(`\n🔍 Generating Aadhaar OTP for session ${sessionId}`);
        
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
        
        // MODIFIED: Removed the check for Aadhaar verification
        // This allows OTP to be generated without prior verification
        
        // Check if already validated - this check is still useful
        if (user.isAadhaarValidated) {
            return {
                success: true,
                message: 'Aadhaar is already validated via OTP',
                data: {
                    isAadhaarValidated: true
                }
            };
        }
        
        // Get Aadhaar number from session data or verification record
        let aadhaarNumber = session.data.aadhaar_number;
        
        // If not in session, try to get from verification record
        if (!aadhaarNumber) {
            const verification = await Verification.findOne({
                userId: session.userId,
                verificationType: 'aadhaar'
            });
            
            if (verification && verification.verificationDetails?.aadhaarNumber) {
                aadhaarNumber = verification.verificationDetails.aadhaarNumber;
            } else {
                throw new Error('Aadhaar number not found in session data or verification records');
            }
        }
        
        // Format Aadhaar number
        aadhaarNumber = formatAadhaarNumber(aadhaarNumber);
        console.log(`🔢 Formatted Aadhaar: "${maskAadhaar(aadhaarNumber)}"`);
        
        if (aadhaarNumber.length !== 12) {
            throw new Error(`Invalid Aadhaar number format: ${maskAadhaar(aadhaarNumber)}`);
        }
        
        // If running in test mode (no SurePass API), simulate OTP generation
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful OTP generation');
            
            // Generate test client ID
            const testClientId = `aadhaar_v2_test_${Date.now().toString(36)}`;
            
            // Update verification record
            let verification = await Verification.findOne({
                userId: session.userId,
                verificationType: 'aadhaar'
            });
            
            if (verification) {
                verification.referenceId = testClientId;
                verification.otp = {
                    sentAt: new Date(),
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                    attempts: 0
                };
                await verification.save();
            } else {
                // Create a new verification record if none exists
                verification = new Verification({
                    userId: session.userId,
                    verificationType: 'aadhaar',
                    mode: 'auto',
                    provider: 'test',
                    status: 'in_progress',
                    referenceId: testClientId,
                    otp: {
                        sentAt: new Date(),
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                        attempts: 0
                    },
                    verificationDetails: {
                        aadhaarNumber
                    }
                });
                await verification.save();
            }
            
            // Update session data
            session.data.aadhaar_client_id = testClientId;
            session.markModified('data');
            await session.save();
            
            return {
                success: true,
                message: 'OTP sent successfully (TEST MODE)',
                data: {
                    client_id: testClientId
                }
            };
        }
        
        // Call SurePass API to generate OTP
        console.log(`📡 Calling SurePass API to generate Aadhaar OTP`);
        const result = await surepassServices.generateAadhaarOTP(aadhaarNumber);
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`Full API response for debugging:`, JSON.stringify(result, null, 2));
        
        // Process API response
        if (result && result.success) {
            // FIXED: Extract client ID by checking multiple possible paths in the response
            let clientId = null;
            
            // Try multiple possible paths for client_id in the response
            if (result.data?.data?.client_id) {
                clientId = result.data.data.client_id;
            } else if (result.data?.client_id) {
                clientId = result.data.client_id;
            }
            
            if (!clientId) {
                console.error('Failed to extract client_id from response:', result);
                return {
                    success: false,
                    message: 'Failed to get client ID from OTP generation response'
                };
            }
            
            // Update verification record
            let verification = await Verification.findOne({
                userId: session.userId,
                verificationType: 'aadhaar'
            });
            
            if (verification) {
                verification.referenceId = clientId;
                verification.otp = {
                    sentAt: new Date(),
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                    attempts: 0
                };
                verification.requestData = {
                    id_number: aadhaarNumber
                };
                await verification.save();
            } else {
                // Create a new verification record if none exists
                verification = new Verification({
                    userId: session.userId,
                    verificationType: 'aadhaar',
                    mode: 'auto',
                    provider: 'surepass',
                    status: 'in_progress',
                    referenceId: clientId,
                    otp: {
                        sentAt: new Date(),
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                        attempts: 0
                    },
                    requestData: {
                        id_number: aadhaarNumber
                    },
                    verificationDetails: {
                        aadhaarNumber
                    }
                });
                await verification.save();
            }
            
            // Update session data
            session.data.aadhaar_client_id = clientId;
            session.markModified('data');
            await session.save();
            
            return {
                success: true,
                message: 'OTP sent to registered mobile number',
                data: {
                    client_id: clientId
                }
            };
        } else {
            // Handle API error
            console.error('API error in OTP generation:', result?.error || 'Unknown error');
            return {
                success: false,
                message: result?.error || 'Failed to generate OTP',
                error: result?.error || 'API call failed'
            };
        }
    } catch (error) {
        console.error('Error generating Aadhaar OTP:', error);
        return {
            success: false,
            message: error.message || 'Error generating Aadhaar OTP'
        };
    }
}

/**
 * Verify Aadhaar OTP
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - OTP verification result
 */
async function verifyAadhaarOTP(sessionId) {
    try {
        console.log(`\n🔍 Verifying Aadhaar OTP for session ${sessionId}`);
        
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
        
        // Get OTP from session data
        const otp = session.data.aadhaar_otp;
        if (!otp) {
            throw new Error('OTP not found in session data');
        }
        
        // Get client ID from session data
        const clientId = session.data.aadhaar_client_id;
        if (!clientId) {
            throw new Error('Client ID not found in session data. Please generate OTP first.');
        }
        
        console.log(`🔢 Verifying OTP "${otp}" for client ID: ${clientId}`);
        
        // Get verification record
        const verification = await Verification.findOne({
            userId: session.userId,
            verificationType: 'aadhaar',
            referenceId: clientId
        });
        
        if (!verification) {
            throw new Error('Verification record not found. Please generate OTP first.');
        }
        
        // Check if OTP is expired
        if (verification.otp?.expiresAt && new Date() > verification.otp.expiresAt) {
            return {
                success: false,
                message: 'OTP has expired. Please generate a new OTP.'
            };
        }
        
        // Increment OTP attempts
        verification.otp.attempts = (verification.otp.attempts || 0) + 1;
        await verification.save();
        
        // If running in test mode (no SurePass API), simulate OTP verification
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful OTP verification');
            
            // Update verification record
            verification.otp.verifiedAt = new Date();
            verification.responseData = {
                ...verification.responseData,
                otpVerification: {
                    success: true,
                    message: 'OTP verified successfully (TEST MODE)',
                    data: {
                        client_id: clientId,
                        full_name: user.name || 'Test User',
                        aadhaar_number: verification.verificationDetails?.aadhaarNumber || '123456789012',
                        dob: '2000-01-01',
                        gender: 'M',
                        address: {
                            country: 'India',
                            state: 'Test State',
                            dist: 'Test District',
                            po: 'Test PO',
                            loc: 'Test Location',
                            vtc: 'Test VTC',
                            subdist: 'Test Subdistrict',
                            street: 'Test Street',
                            house: 'Test House',
                            landmark: 'Test Landmark'
                        },
                        zip: '123456',
                        has_image: false,
                        status: 'success_aadhaar'
                    }
                }
            };
            await verification.save();
            
            // Update user model
            user.isAadhaarValidated = true;
            await user.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: user._id,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: verification._id,
                description: 'Aadhaar OTP verification completed successfully',
                details: {
                    verificationType: 'aadhaar_otp',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return {
                success: true,
                message: 'Aadhaar OTP verified successfully (TEST MODE)',
                data: {
                    isAadhaarValidated: true
                }
            };
        }
        
        // Call SurePass API to verify OTP
        console.log(`📡 Calling SurePass API to verify Aadhaar OTP`);
        const result = await surepassServices.verifyAadhaarOTP(clientId, otp);
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`Full API response for debugging:`, JSON.stringify(result, null, 2));
        
        // Process API response
        if (result && result.success) {
            // Update verification record
            verification.otp.verifiedAt = new Date();
            verification.responseData = {
                ...verification.responseData,
                otpVerification: result.data
            };
            await verification.save();
            
            // Update user model
            user.isAadhaarValidated = true;
            await user.save();
            
            // Extract user details if available
            if (result.data && result.data.full_name) {
                // Ensure verification details has the user's name
                verification.verificationDetails = {
                    ...verification.verificationDetails,
                    aadhaarName: result.data.full_name
                };
                await verification.save();
                
                // Update user's name if not set
                if (!user.name && result.data.full_name) {
                    user.name = result.data.full_name;
                    await user.save();
                }
            }
            
            // Log activity
            await ActivityLog.create({
                actorId: user._id,
                actorModel: 'Users',
                actorName: user.name || user.phone,
                action: 'verification_completed',
                entityType: 'Verification',
                entityId: verification._id,
                description: 'Aadhaar OTP verification completed successfully',
                details: {
                    verificationType: 'aadhaar_otp',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            return {
                success: true,
                message: 'Aadhaar OTP verified successfully',
                data: {
                    isAadhaarValidated: true
                }
            };
        } else {
            // Handle API error
            console.error('API error in OTP verification:', result?.error || 'Unknown error');
            return {
                success: false,
                message: result?.error || 'Failed to verify OTP',
                error: result?.error || 'Invalid OTP'
            };
        }
    } catch (error) {
        console.error('Error verifying Aadhaar OTP:', error);
        return {
            success: false,
            message: error.message || 'Error verifying Aadhaar OTP'
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
        console.log(`Full API response for debugging:`, JSON.stringify(result, null, 2));
        
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

/**
 * Verify bank account
 * @param {String} sessionId - The session ID
 * @returns {Promise<Object>} - Verification result
 */
async function verifyBankAccount(sessionId) {
    try {
        console.log(`\n🔍 Verifying bank account for session ${sessionId}`);
        
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
        
        // Get account details from session data
        const rawAccountNumber = session.data.account_number;
        const rawIfscCode = session.data.ifsc_code;
        const accountHolderName = session.data.account_holder_name || user.name;
        
        if (!rawAccountNumber) {
            throw new Error('Account number not found in session data');
        }
        
        if (!rawIfscCode) {
            throw new Error('IFSC code not found in session data');
        }
        
        // Format account details
        const accountNumber = formatAccountNumber(rawAccountNumber);
        const ifscCode = formatIfscCode(rawIfscCode);
        
        console.log(`🔢 Account number: "${maskAccountNumber(accountNumber)}"`);
        console.log(`🔢 IFSC code: "${ifscCode}"`);
        
        if (accountNumber.length < 8) {
            throw new Error(`Invalid account number format: Account numbers are usually at least 8 digits`);
        }
        
        if (ifscCode.length !== 11) {
            throw new Error(`Invalid IFSC code format: IFSC codes must be 11 characters`);
        }
        
        // If running in test mode (no SurePass API), simulate verification
        const isTestMode = !process.env.SUREPASS_API_KEY || process.env.TEST_MODE === 'true';
        
        if (isTestMode) {
            console.log('🧪 Running in TEST MODE - simulating successful verification');
            
            // Create verification record
            const verification = new Verification({
                userId: session.userId,
                verificationType: 'bank_account',
                mode: 'auto',
                provider: 'test',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                verificationDetails: {
                    accountNumber,
                    ifscCode,
                    accountHolderName,
                    bankName: 'Test Bank',
                    nameMatch: {
                        status: true,
                        score: 100,
                        details: { matched: true, source: 'test_mode' }
                    }
                },
                responseData: {
                    success: true,
                    message: 'Test verification success',
                    data: {
                        account_exists: true,
                        full_name: accountHolderName || 'Test User',
                        status: 'success',
                        ifsc_details: {
                            ifsc: ifscCode,
                            bank: 'Test Bank',
                            branch: 'Test Branch',
                            address: 'Test Address'
                        }
                    },
                    verification_id: `test-${Date.now()}`
                },
                verificationAttempts: [{
                    attemptedAt: new Date(),
                    status: 'success',
                    data: { 
                        mode: 'test',
                        accountNumber,
                        accountHolderName
                    }
                }]
            });
            
            await verification.save();
            console.log('✅ Test verification record created');
            
            // Update session data with bank details
            session.data.bank_name = 'Test Bank';
            session.data.is_bank_verified = true;
            session.markModified('data');
            await session.save();
            
            return {
                success: true,
                message: 'Bank account verified successfully (TEST MODE)',
                data: {
                    accountHolderName,
                    accountNumber: maskAccountNumber(accountNumber),
                    ifscCode,
                    bankName: 'Test Bank'
                }
            };
        }
        
        // Create or update verification record
        let verification = await Verification.findOne({
            userId: session.userId,
            verificationType: 'bank_account'
        });
        
        if (!verification) {
            verification = new Verification({
                userId: session.userId,
                verificationType: 'bank_account',
                mode: 'auto',
                provider: 'surepass',
                status: 'in_progress',
                verificationDetails: {
                    accountNumber,
                    ifscCode,
                    accountHolderName,
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
                accountNumber,
                ifscCode,
                accountHolderName,
                nameMatch: verification.verificationDetails.nameMatch || {
                    status: null,
                    score: null,
                    details: {}
                }
            };
        }
        
        await verification.save();
        console.log(`✅ Verification record created/updated with ID: ${verification._id}`);
        
        // Call SurePass API to verify bank account
        console.log(`📡 Calling SurePass API to verify bank account`);
        
        const result = await surepassServices.verifyBankAccount(
            accountNumber, 
            ifscCode, 
            accountHolderName,
            true // fetch IFSC details
        );
        
        console.log(`📡 SurePass API response received: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`Full API response for debugging:`, JSON.stringify(result, null, 2));
        
        // Process verification result
        if (result && result.success) {
            // Extract verification data
            const apiAccountName = result.data?.data?.full_name || null;
            const bankName = result.data?.data?.ifsc_details?.bank || result.data?.data?.ifsc_details?.bank_name || null;
            const accountExists = result.data?.data?.account_exists === true;
            
            console.log(`👤 Extracted account holder name: ${apiAccountName || 'Not available'}`);
            console.log(`🏦 Extracted bank name: ${bankName || 'Not available'}`);
            console.log(`✅ Account exists: ${accountExists ? 'YES' : 'NO'}`);
            
            if (!accountExists) {
                // Account doesn't exist
                verification.status = 'failed';
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Account does not exist',
                    data: result.data
                });
                await verification.save();
                
                return {
                    success: false,
                    message: 'Bank account could not be verified. Please check the account number and IFSC code.'
                };
            }
            
            // Check name match if API returned a name
            const namesMatch = !accountHolderName || !apiAccountName || doNamesMatch(accountHolderName, apiAccountName);
            console.log(`🔍 Name match check: ${namesMatch ? 'PASSED' : 'FAILED'}`);
            
            if (!namesMatch && accountHolderName) {
                // Name mismatch
                verification.status = 'failed';
                verification.verificationDetails.nameMatch = {
                    status: false,
                    score: 0,
                    details: {
                        providedName: accountHolderName,
                        apiName: apiAccountName,
                        reason: 'Name mismatch'
                    }
                };
                verification.verificationAttempts.push({
                    attemptedAt: new Date(),
                    status: 'failure',
                    reason: 'Name mismatch',
                    data: {
                        providedName: accountHolderName,
                        apiName: apiAccountName
                    }
                });
                await verification.save();
                
                return {
                    success: false,
                    message: 'The account holder name provided does not match the name registered with this bank account'
                };
            }
            
            // Update verification record with success
            verification.status = 'completed';
            verification.verificationDetails = {
                ...verification.verificationDetails,
                bankName,
                nameMatch: {
                    status: namesMatch,
                    score: namesMatch ? 100 : 0,
                    details: { matched: namesMatch }
                }
            };
            
            if (apiAccountName) {
                verification.verificationDetails.accountHolderName = apiAccountName;
            }
            
            verification.responseData = result.data;
            verification.completedAt = new Date();
            verification.verificationAttempts.push({
                attemptedAt: new Date(),
                status: 'success',
                data: result.data
            });
            
            await verification.save();
            console.log(`✅ Verification record updated to COMPLETED status`);
            
            // Update session data with bank details
            session.data.bank_name = bankName;
            session.data.is_bank_verified = true;
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
                description: 'Bank account verification completed successfully',
                details: {
                    verificationType: 'bank_account',
                    verificationMode: 'auto'
                },
                status: 'success'
            });
            
            // Return success
            return {
                success: true,
                message: 'Bank account verified successfully',
                data: {
                    accountHolderName: apiAccountName || accountHolderName,
                    accountNumber: maskAccountNumber(accountNumber),
                    ifscCode,
                    bankName
                }
            };
        } else {
            // Handle API error
            verification.status = 'failed';
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
                message: result?.error || 'Bank account verification failed'
            };
        }
    } catch (error) {
        console.error('Error verifying bank account:', error);
        return {
            success: false,
            message: error.message || 'Error verifying bank account'
        };
    }
}

module.exports = {
    verifyAadhaar,
    verifyPAN,
    checkAadhaarPanLink,
    generateAadhaarOTP,
    verifyAadhaarOTP,
    verifyBankAccount,
    // Also export helper functions for testing
    formatAadhaarNumber,
    formatAadhaarDisplay,
    formatPanNumber,
    formatAccountNumber,
    formatIfscCode,
    doNamesMatch,
    maskAadhaar,
    maskAccountNumber
};