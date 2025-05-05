 // 2. CONTROLLERS
  // controllers/userControllers.js
  const jwt = require('jsonwebtoken');
  const axios = require('axios');
  const { postJSON, postFormData } = require('../services/surepassServices');
  const { User } = require('../models/Users');
  const { UserToken } = require('../models/userTokens');
  const { UserSession } = require('../models/UserSessions');
  const { AadhaarVerification } = require('../models/aadhaarVerification');
  const { PanVerification } = require('../models/panVerification');
  const { BankingVerification } = require('../models/bankVerification');
  const { Product } = require('../models/Products');
  const { Campaign } = require('../models/Campaigns');
  const { Workflow } = require('../models/Workflows');
  
  // OTP generator
  const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
  
  /**
  * ✅ Send OTP for Registration
  */
  const registerWithOtp = async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) return res.status(400).json({ 
    success: false,
    message: 'Phone number is required' 
  });
  
  try {
    const existingUser = await User.findOne({ phone });
  
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'User already exists' 
      });
    }
  
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
  
    // First, send OTP
    await sendOtpViaWhatsapp(phone, otp);
  
    // Only if OTP sent successfully, save user
    const user = await User.create({ phone, otp, otpExpiresAt: expiresAt });
  
    return res.status(200).json({ 
      success: true,
      message: 'OTP sent successfully', 
      data: { userId: user._id }
    });
  } catch (err) {
    console.error('Error in registerWithOtp:', err.response?.data || err.message);
    return res.status(500).json({ 
      success: false,
      message: 'Registration failed', 
      error: err.message 
    });
  }
  };
  
  /**
  * ✅ Send OTP for Login
  */
  const loginWithOtp = async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) return res.status(400).json({ 
    success: false,
    message: 'Phone number is required' 
  });
  
  try {
    const user = await User.findOne({ phone });
  
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
  
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
    // First, send OTP
    await sendOtpViaWhatsapp(phone, otp);
  
    // Only after successful OTP send, update DB
    user.otp = otp;
    user.otpExpiresAt = expiresAt;
    user.isOtpVerified = false;
    await user.save();
  
    return res.status(200).json({ 
      success: true,
      message: 'OTP sent for login' 
    });
  } catch (err) {
    console.error('Error in loginWithOtp:', err.response?.data || err.message);
    return res.status(500).json({ 
      success: false,
      message: 'Login failed', 
      error: err.message 
    });
  }
  };
  
  /**
  * ✅ Verify OTP (common for both login and registration)
  */
  const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) return res.status(400).json({ 
    success: false,
    message: 'Phone and OTP are required' 
  });
  
  try {
    const user = await User.findOne({ phone });
  
    if (!user) return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
  
    if (user.isOtpVerified) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP already verified' 
      });
    }
  
    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP expired' 
      });
    }
  
    if (user.otp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP' 
      });
    }
  
    // Update user verification status
    // Use updateOne to avoid validation issues with null values
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { isOtpVerified: true },
        $unset: { otp: "", otpExpiresAt: "" }
      }
    );
  
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        phone: user.phone 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // Token expires in 30 days
    );
  
    // Store token in UserToken model
    // First, check if user already has a token and remove it
    await UserToken.findOneAndDelete({ userId: user._id });
    
    // Create new token document
    await UserToken.create({
      userId: user._id,
      token: token
    });
  
    return res.status(200).json({ 
      success: true,
      message: 'OTP verified successfully', 
      data: {
        user: {
          _id: user._id,
          phone: user.phone,
          isOtpVerified: true
        },
        token
      }
    });
  } catch (err) {
    console.error('Error in verifyOtp:', err.message);
    return res.status(500).json({ 
      success: false,
      message: 'OTP verification failed', 
      error: err.message 
    });
  }
  };
  
  /**
  * ✅ Helper to send OTP via WhatsApp
  */
  const sendOtpViaWhatsapp = async (phone, otp) => {
    const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const headers = {
      'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json'
    };
    const data = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "otp_template", 
        language: {
          code: "en_US"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otp 
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                text: "copycode" // This can be any text - it's not the visible button text
              }
            ]
          }
        ]
      }
    };
  
    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error?.message || 'Failed to send OTP');
    }
  };
  
  /**
  * ✅ Update Profile and Select Product
  */
  const updateProfileAndProduct = async (req, res) => {
    try {
        const { name, email_id, productId } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name is required"
            });
        }
        
        // Check if the product exists
        if (productId) {
            const product = await Product.findById(productId);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found with the provided ID"
                });
            }
        }
        
        // If product exists, proceed with user update
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.userId },
            {
                $set: {
                    name,
                    email_id,
                    ...(productId && { productId })
                }
            },
            { new: true } // Returns the updated document
        );
        
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "User profile updated successfully",
            data: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email_id: updatedUser.email_id,
                phone: updatedUser.phone,
                productId: updatedUser.productId
            }
        });
    } catch (err) {
        console.error("Error updating profile and product:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
  };
  
  /**
  * ✅ Get User Profile
  */
  const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate('productId', 'name price')
            .populate('campaignId', 'name');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Get verification status
        const aadhaarVerification = await AadhaarVerification.findOne({ userId: req.userId });
        const panVerification = await PanVerification.findOne({ userId: req.userId });
        const bankVerification = await BankingVerification.findOne({ userId: req.userId });
        
        const response = {
            _id: user._id,
            name: user.name,
            email_id: user.email_id,
            phone: user.phone,
            product: user.productId,
            campaign: user.campaignId,
            verificationStatus: {
                isOtpVerified: user.isOtpVerified,
                isPanVerified: user.isPanVerified,
                isAadhaarVerified: user.isAadhaarVerified,
                isAadhaarValidated: user.isAadhaarValidated,
                isBankVerified: bankVerification?.isVerified || false
            }
        };
        
        if (aadhaarVerification) {
            response.aadhaarDetails = {
                isVerified: aadhaarVerification.isVerified,
                aadhaarNumber: aadhaarVerification.aadhaarNumber ? 
                    aadhaarVerification.aadhaarNumber.substring(0, 4) + ' XXXX XXXX' : null
            };
        }
        
        if (panVerification) {
            response.panDetails = {
                isVerified: panVerification.isVerified,
                panNumber: panVerification.panNumber ? 
                    panVerification.panNumber.substring(0, 2) + 'XXXXX' + 
                    panVerification.panNumber.substring(7) : null
            };
        }
        
        if (bankVerification) {
            response.bankDetails = {
                isVerified: bankVerification.isVerified,
                accountNumber: bankVerification.accountNumber ? 
                    'XXXXXXXX' + bankVerification.accountNumber.slice(-4) : null,
                ifscCode: bankVerification.ifscCode,
                bankName: bankVerification.bankName
            };
        }
        
        res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: response
        });
    } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
  };
  
  /**
  * ✅ Helper function to check if names match
  */
  const doNamesMatch = (dbName, aadhaarName) => {
  if (!dbName || !aadhaarName) return false;
  
  // Convert both names to lowercase and remove extra spaces
  const normalizedDbName = dbName.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedAadhaarName = aadhaarName.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Check for exact match first
  if (normalizedDbName === normalizedAadhaarName) {
    return true;
  }
  
  // Check if one name contains the other (for partial matches)
  return normalizedAadhaarName.includes(normalizedDbName) || 
         normalizedDbName.includes(normalizedAadhaarName);
  };
  
  /**
  * ✅ Upload and Process Aadhaar Card (OCR)
  */
  const aadhaarOCR = async (req, res) => {
  try {
    // Get userId from request (assuming it comes from auth middleware)
    const userId = req.userId;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already Aadhaar verified
    let aadhaarVerification = await AadhaarVerification.findOne({ userId });
    if (aadhaarVerification && aadhaarVerification.ocrVerified) {
      // User is already verified via OCR
      return res.status(200).json({
        success: true,
        message: 'Aadhaar OCR already verified',
        data: {
          isVerified: aadhaarVerification.isVerified,
          ocrVerified: aadhaarVerification.ocrVerified
        }
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
    
    // Process front side
    const frontResult = await postFormData('/api/v1/ocr/aadhaar', frontFile.buffer, 'file');
    
    // Check if front processing was successful
    if (!frontResult || !frontResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to extract information from Aadhaar front document',
        error: frontResult?.error || 'OCR processing failed'
      });
    }
    
    // Process back side
    const backResult = await postFormData('/api/v1/ocr/aadhaar', backFile.buffer, 'file');
    
    // Check if back processing was successful
    if (!backResult || !backResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to extract information from Aadhaar back document',
        error: backResult?.error || 'OCR processing failed'
      });
    }
    
    // Both front and back were successful, merge the data
    const mergedData = {
      front: frontResult.data,
      back: backResult.data
    };
    
    // Extract name from Aadhaar data
    let aadhaarName = null;
    
    // Extract name from the correct location in the response structure
    if (frontResult.data && 
        frontResult.data.ocr_fields && 
        frontResult.data.ocr_fields.length > 0 &&
        frontResult.data.ocr_fields[0].full_name) {
      aadhaarName = frontResult.data.ocr_fields[0].full_name.value;
    }
    
    // Extract Aadhaar number
    let aadhaarNumber = null;
    
    if (frontResult.data && 
        frontResult.data.ocr_fields && 
        frontResult.data.ocr_fields.length > 0 &&
        frontResult.data.ocr_fields[0].aadhaar_number) {
      aadhaarNumber = frontResult.data.ocr_fields[0].aadhaar_number.value;
    }
    
    // Get DB name
    const dbName = user.name || '';
    
    // Check if Aadhaar name was found
    if (!aadhaarName) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract name from Aadhaar card',
        data: {
          registeredName: dbName,
          aadhaarData: mergedData
        }
      });
    }
    
    // Check if names match
    if (dbName && !doNamesMatch(dbName, aadhaarName)) {
      return res.status(400).json({
        success: false,
        message: 'Name in Aadhaar card does not match your registered name',
        data: {
          dbName: dbName,
          aadhaarName: aadhaarName
        }
      });
    }
    
    // Create or update Aadhaar verification record
    if (!aadhaarVerification) {
      aadhaarVerification = new AadhaarVerification({
        userId,
        aadhaarNumber,
        aadhaarData: JSON.stringify(mergedData),
        ocrVerified: true,
        isVerified: false, // Not fully verified until OTP step is complete
        verificationDate: new Date()
      });
    } else {
      aadhaarVerification.aadhaarNumber = aadhaarNumber;
      aadhaarVerification.aadhaarData = JSON.stringify(mergedData);
      aadhaarVerification.ocrVerified = true;
      aadhaarVerification.verificationDate = new Date();
    }
    
    await aadhaarVerification.save();
    
    // Update user verification status for OCR step
    user.isAadhaarVerified = true;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Aadhaar OCR processed successfully',
      data: {
        aadhaarName,
        aadhaarNumber: aadhaarNumber ? aadhaarNumber.substring(0, 4) + ' XXXX XXXX' : null,
        isOcrVerified: true
      }
    });
    
  } catch (error) {
    console.error('Error in Aadhaar OCR:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
  };
  
  /**
  * ✅ Upload and Process PAN Card (OCR)
  */
  const panOCR = async (req, res) => {
  try {
    // Get userId from request (assuming it comes from auth middleware)
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
    
    // Check if user is already PAN verified
    let panVerification = await PanVerification.findOne({ userId });
    if (panVerification && panVerification.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'PAN already verified',
        data: {
          isVerified: true,
          panNumber: panVerification.panNumber ? 
            panVerification.panNumber.substring(0, 2) + 'XXXXX' + 
            panVerification.panNumber.substring(7) : null
        }
      });
    }
    
    // Check for PAN document
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'PAN document is required' 
      });
    }
    
    // Call Surepass API for PAN OCR
    const ocrResult = await postFormData('/api/v1/ocr/pan', req.file.buffer, 'file');
    
    // Check if processing was successful
    if (!ocrResult || !ocrResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to extract information from PAN document',
        error: ocrResult?.error || 'OCR processing failed'
      });
    }
    
    // Extract name from PAN data based on the actual response structure
    let panName = null;
    
    if (ocrResult.data && 
        ocrResult.data.ocr_fields && 
        ocrResult.data.ocr_fields.length > 0 &&
        ocrResult.data.ocr_fields[0].full_name) {
      panName = ocrResult.data.ocr_fields[0].full_name.value;
    }
    
    // Extract PAN number
    let panNumber = null;
    
    if (ocrResult.data && 
        ocrResult.data.ocr_fields && 
        ocrResult.data.ocr_fields.length > 0 &&
        ocrResult.data.ocr_fields[0].pan_number) {
      panNumber = ocrResult.data.ocr_fields[0].pan_number.value;
    }
    
    // Get DB name
    const dbName = user.name || '';
    
    // Check if PAN name was found
    if (!panName) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract name from PAN card',
        data: {
          registeredName: dbName,
          panData: ocrResult.data
        }
      });
    }
    
    // Check if names match
    if (dbName && !doNamesMatch(dbName, panName)) {
      return res.status(400).json({
        success: false,
        message: 'Name in PAN card does not match your registered name',
        data: {
          registeredName: dbName,
          panName: panName
        }
      });
    }
    
    // Create or update PAN verification record
    if (!panVerification) {
      panVerification = new PanVerification({
        userId,
        panNumber,
        panData: JSON.stringify(ocrResult.data),
        isVerified: true,
        nameOnPan: panName,
        verificationDate: new Date()
      });
    } else {
      panVerification.panNumber = panNumber;
      panVerification.panData = JSON.stringify(ocrResult.data);
      panVerification.isVerified = true;
      panVerification.nameOnPan = panName;
      panVerification.verificationDate = new Date();
    }
    
    await panVerification.save();
    
    // Update user verification status
    user.isPanVerified = true;
    await user.save();
    
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
    
  } catch (error) {
    console.error('Error in PAN OCR:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
  };
  
  /**
 * ✅ Check if Aadhaar and PAN are linked
 */
const aadhaarPanLink = async (req, res) => {
    try {
      // Get userId from request (assuming it comes from auth middleware)
      const userId = req.userId;
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if Aadhaar is verified
      if (!user.isAadhaarVerified) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar is not verified yet. Please verify your Aadhaar first.'
        });
      }
      
      // Check if PAN is verified
      if (!user.isPanVerified) {
        return res.status(400).json({
          success: false,
          message: 'PAN is not verified yet. Please verify your PAN first.'
        });
      }
      
      // Get verification records
      const aadhaarVerification = await AadhaarVerification.findOne({ userId });
      const panVerification = await PanVerification.findOne({ userId });
      
      if (!aadhaarVerification || !panVerification) {
        return res.status(400).json({
          success: false,
          message: 'Verification records not found. Please complete verification process first.'
        });
      }
      
      // Check if Aadhaar number is present
      if (!aadhaarVerification.aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number is missing in verification records. Please verify your Aadhaar again.'
        });
      }
      
      // Check if PAN number is present
      if (!panVerification.panNumber) {
        return res.status(400).json({
          success: false,
          message: 'PAN number is missing in verification records. Please verify your PAN again.'
        });
      }
      
      // Call Surepass API to check if Aadhaar and PAN are linked
      const linkCheckData = {
        id_number: aadhaarVerification.aadhaarNumber,
        consent: "Y",
        pan_number: panVerification.panNumber
      };
      
      const linkCheckResult = await postJSON('/api/v1/pan-aadhaar-link/pan-link-status', linkCheckData);
      
      if (linkCheckResult && linkCheckResult.success) {
        return res.status(200).json({
          success: true,
          message: 'Aadhaar and PAN link status checked successfully',
          data: linkCheckResult.data
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to check Aadhaar-PAN link',
          error: linkCheckResult?.error || 'API call failed'
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
   * ✅ Generate Aadhaar OTP for verification
   */
  const generateAadhaarOTP = async (req, res) => {
    try {
      // Get userId from request (assuming it comes from auth middleware)
      const userId = req.userId;
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if Aadhaar is already verified in primary verification
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
      const aadhaarVerification = await AadhaarVerification.findOne({ userId });
      
      if (!aadhaarVerification) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar verification record not found. Please complete Aadhaar OCR verification first.'
        });
      }
      
      // Check if Aadhaar number is present
      if (!aadhaarVerification.aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number is missing in verification records. Please verify your Aadhaar again.'
        });
      }
      
      // Call Surepass API to generate OTP
      const otpRequestData = {
        id_number: aadhaarVerification.aadhaarNumber
      };
      
      const otpResult = await postJSON('/api/v1/aadhaar-v2/generate-otp', otpRequestData);
      
      if (otpResult && otpResult.success) {
        // Store the client_id temporarily in the verification record for use when submitting OTP
        aadhaarVerification.aadhaarClientId = otpResult.data.client_id;
        await aadhaarVerification.save();
        
        return res.status(200).json({
          success: true,
          message: 'OTP sent to registered mobile number',
          data: {
            client_id: otpResult.data.client_id
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to generate OTP',
          error: otpResult?.error || 'OTP generation failed'
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
   * ✅ Verify Aadhaar OTP
   */
  const verifyAadhaarOTP = async (req, res) => {
    try {
      // Get userId from request
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
      
      // Get Aadhaar verification data
      const aadhaarVerification = await AadhaarVerification.findOne({ userId });
      
      if (!aadhaarVerification) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar verification record not found. Please complete Aadhaar OCR verification first.'
        });
      }
      
      // Check if client_id is present
      if (!aadhaarVerification.aadhaarClientId) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar client ID not found. Please generate OTP first.'
        });
      }
      
      // Call Surepass API to verify OTP
      const verifyOtpData = {
        client_id: aadhaarVerification.aadhaarClientId,
        otp: otp
      };
      
      const verifyResult = await postJSON('/api/v1/aadhaar-v2/submit-otp', verifyOtpData);
      
      if (verifyResult && verifyResult.success) {
        // Update user model to mark Aadhaar as validated
        user.isAadhaarValidated = true;
        await user.save();
        
        // Update verification record
        aadhaarVerification.otpVerified = true;
        aadhaarVerification.isVerified = true;
        aadhaarVerification.validationData = JSON.stringify(verifyResult.data);
        await aadhaarVerification.save();
        
        return res.status(200).json({
          success: true,
          message: 'Aadhaar validated successfully',
          data: {
            isAadhaarValidated: true
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to verify OTP',
          error: verifyResult?.error || 'OTP verification failed'
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
   * ✅ Add or update bank account details
   */
  const updateBankAccount = async (req, res) => {
    try {
      const { accountNumber, ifscCode, bankName, accountHolderName } = req.body;
      const userId = req.userId;
      
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
      
      // Find or create banking verification record
      let bankingVerification = await BankingVerification.findOne({ userId });
      
      if (!bankingVerification) {
        bankingVerification = new BankingVerification({
          userId,
          accountNumber,
          ifscCode,
          bankName: bankName || '',
          accountHolderName,
          isVerified: false
        });
      } else {
        bankingVerification.accountNumber = accountNumber;
        bankingVerification.ifscCode = ifscCode;
        bankingVerification.bankName = bankName || bankingVerification.bankName;
        bankingVerification.accountHolderName = accountHolderName;
        bankingVerification.isVerified = false; // Reset verification status when details change
      }
      
      await bankingVerification.save();
      
      res.status(200).json({
        success: true,
        message: 'Banking details updated successfully',
        data: {
          accountNumber: accountNumber,
          ifscCode: ifscCode,
          bankName: bankingVerification.bankName,
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
   * ✅ Verify bank account using penny drop
   */
  const verifyBankAccount = async (req, res) => {
    try {
      const userId = req.userId;
      
      // Get banking details
      const bankingVerification = await BankingVerification.findOne({ userId });
      if (!bankingVerification) {
        return res.status(404).json({
          success: false,
          message: 'Banking details not found. Please add your banking details first.'
        });
      }
      
      // If already verified, return success
      if (bankingVerification.isVerified) {
        return res.status(200).json({
          success: true,
          message: 'Bank account already verified',
          data: {
            isVerified: true,
            accountHolderName: bankingVerification.accountHolderName,
            accountNumber: 'XXXXXXXX' + bankingVerification.accountNumber.slice(-4),
            ifscCode: bankingVerification.ifscCode,
            bankName: bankingVerification.bankName
          }
        });
      }
      
      // Call SurePass API for penny drop verification
      const pennyDropData = {
        account_number: bankingVerification.accountNumber,
        ifsc: bankingVerification.ifscCode,
        name: bankingVerification.accountHolderName,
        mobile: null // Optional
      };
      
      const pennyDropResult = await postJSON('/api/v1/penny-drop/sync', pennyDropData);
      
      if (pennyDropResult && pennyDropResult.success) {
        // Update banking verification record
        bankingVerification.isVerified = true;
        bankingVerification.verificationMethod = 'penny-drop';
        bankingVerification.verificationData = JSON.stringify(pennyDropResult.data);
        bankingVerification.verificationDate = new Date();
        await bankingVerification.save();
        
        return res.status(200).json({
          success: true,
          message: 'Bank account verified successfully',
          data: {
            isVerified: true,
            accountHolderName: bankingVerification.accountHolderName,
            accountNumber: 'XXXXXXXX' + bankingVerification.accountNumber.slice(-4),
            ifscCode: bankingVerification.ifscCode,
            bankName: bankingVerification.bankName
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to verify bank account',
          error: pennyDropResult?.error || 'Penny drop verification failed'
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
   * ✅ Get User's Workflow Status
   */
  const getUserWorkflowStatus = async (req, res) => {
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
      
      if (!user.workflowId) {
        return res.status(404).json({
          success: false,
          message: 'No workflow associated with this user'
        });
      }
      
      // Get the active session
      const session = await UserSession.findOne({
        userId: user._id,
        status: 'active'
      }).sort({ createdAt: -1 });
      
      // Get the workflow
      const workflow = await Workflow.findById(user.workflowId);
      
      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
      }
      
      // Get current node information
      let currentNodeInfo = null;
      if (session && session.currentNodeId) {
        const currentNode = workflow.nodes.find(node => node.nodeId === session.currentNodeId);
        if (currentNode) {
          currentNodeInfo = {
            nodeId: currentNode.nodeId,
            type: currentNode.type,
            name: currentNode.name
          };
        }
      }
      
      // Get all sessions for this user and workflow
      const allSessions = await UserSession.find({
        userId: user._id,
        workflowId: user.workflowId
      }).sort({ createdAt: -1 });
      
      // Count completed nodes from all sessions
      const completedNodes = new Set();
      allSessions.forEach(s => {
        if (s.stepsCompleted && Array.isArray(s.stepsCompleted)) {
          s.stepsCompleted.forEach(nodeId => completedNodes.add(nodeId));
        }
      });
      
      // Calculate progress percentage
      const totalNodes = workflow.nodes.length;
      const progress = totalNodes > 0 
        ? (completedNodes.size / totalNodes) * 100 
        : 0;
      
      const response = {
        workflowName: workflow.name,
        workflowId: workflow._id,
        currentSession: session ? {
          sessionId: session._id,
          status: session.status,
          currentNode: currentNodeInfo,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        } : null,
        progress: progress.toFixed(2) + '%',
        completedNodes: completedNodes.size,
        totalNodes: totalNodes,
        allSessions: allSessions.map(s => ({
          sessionId: s._id,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }))
      };
      
      res.status(200).json({
        success: true,
        message: 'User workflow status fetched successfully',
        data: response
      });
    } catch (error) {
      console.error('Error fetching user workflow status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
  
  module.exports = {
    registerWithOtp,
    loginWithOtp,
    verifyOtp,
    updateProfileAndProduct,
    getUserProfile,
    getUserWorkflowStatus,
    aadhaarOCR,
    panOCR,
    aadhaarPanLink,
    generateAadhaarOTP,
    verifyAadhaarOTP,
    updateBankAccount,
    verifyBankAccount
  };
  