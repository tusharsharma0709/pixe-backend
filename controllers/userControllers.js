const jwt = require('jsonwebtoken');
const axios = require('axios');
const { postJSON, postFormData } = require('../services/surepassServices');
const { User } = require('../models/Users');
const { UserToken } = require('../models/userTokens');
const { UserKYC } = require('../models/UserKYC');
const { Product } = require('../models/Products');

// OTP generator
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// SEND OTP for Registration
const registerWithOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) return res.status(400).json({ message: 'Phone number is required' });

  try {
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // First, send OTP
    await sendOtpViaWhatsapp(phone, otp);

    // Only if OTP sent successfully, save user
    const user = await User.create({ phone, otp, otpExpiresAt: expiresAt });

    return res.status(200).json({ message: 'OTP sent successfully', userId: user._id });
  } catch (err) {
    console.error('Error in registerWithOtp:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// SEND OTP for Login
const loginWithOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) return res.status(400).json({ message: 'Phone number is required' });

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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

    return res.status(200).json({ message: 'OTP sent for login' });
  } catch (err) {
    console.error('Error in loginWithOtp:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// VERIFY OTP (common for both login and registration)
const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP are required' });

  try {
    const user = await User.findOne({ phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isOtpVerified) {
      return res.status(400).json({ message: 'OTP already verified' });
    }

    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
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
      process.env.JWT_SECRET, // Make sure this is in your .env file
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
      message: 'OTP verified successfully', 
      user: {
        _id: user._id,
        phone: user.phone,
        isOtpVerified: true
      },
      token
    });
  } catch (err) {
    console.error('Error in verifyOtp:', err.message);
    return res.status(500).json({ message: 'OTP verification failed', error: err.message });
  }
};

// Helper to send OTP via WhatsApp
const sendOtpViaWhatsapp = async (phone, otp) => {
    const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
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
    } catch (error) {
      throw new Error(error.response?.data?.error?.message || 'Failed to send OTP');
    }
};

const updateProfileAndProduct = async (req, res) => {
    try {
        const { name, email_id, productId } = req.body;
        
        // Check if the product exists
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found with the provided ID"
            });
        }
        
        // If product exists, proceed with user update
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.userId },
            {
                $set: {
                    name,
                    email_id,
                    productId
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
            message: "User profile updated and product selection completed successfully"
        });
    } catch (err) {
        console.error("Error updating profile and product:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
}


// Helper function to check if names match
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

const aadhaarOCR= async (req, res) => {
  try {
    // Get userId from request (assuming it comes from auth middleware)
    const userId = req.userId; // Or req.body.userId if passed in the request
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already Aadhaar verified
    if (user.isAadhaarVerified) {
      // Fetch existing Aadhaar data
      const userKYC = await UserKYC.findOne({ userId });
      const aadhaarData = userKYC ? JSON.parse(userKYC.aadhaarData || '{}') : null;
      
      return res.status(200).json({
        success: true,
        message: 'User is already Aadhaar verified',
        data: {
          isAadhaarVerified: true,
          aadhaarData: aadhaarData
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
    if (!doNamesMatch(dbName, aadhaarName)) {
      return res.status(400).json({
        success: false,
        message: 'Name in Aadhaar card does not match your registered name',
        data: {
          dbName: dbName,
          aadhaarName: aadhaarName
        }
      });
    }
    
    // Now store the merged data in UserKYC
    let userKYC = await UserKYC.findOne({ userId });
    
    if (!userKYC) {
      // Create new KYC record if none exists
      userKYC = new UserKYC({
        userId,
        aadhaarData: JSON.stringify(mergedData),
        aadhaarNumber: aadhaarNumber // Store the extracted Aadhaar number
      });
    } else {
      // Update existing KYC record
      userKYC.aadhaarData = JSON.stringify(mergedData);
      if (aadhaarNumber) {
        userKYC.aadhaarNumber = aadhaarNumber;
      }
    }
    
    await userKYC.save();
    
    // Update user verification status since both front and back were successful
    // and name has been verified
    user.isAadhaarVerified = true;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Aadhaar documents processed successfully',
      data: {
        aadhaarData: mergedData,
        aadhaarNumber: aadhaarNumber,
        isAadhaarVerified: true
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
}

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
    if (user.isPanVerified) {
      // Fetch existing PAN data
      const userKYC = await UserKYC.findOne({ userId });
      const panData = userKYC ? JSON.parse(userKYC.panData || '{}') : null;
      
      return res.status(200).json({
        success: true,
        message: 'User is already PAN verified',
        data: {
          isPanVerified: true,
          panData: panData,
          panNumber: userKYC?.panNumber
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
    if (!doNamesMatch(dbName, panName)) {
      return res.status(400).json({
        success: false,
        message: 'Name in PAN card does not match your registered name',
        data: {
          registeredName: dbName,
          panName: panName
        }
      });
    }
    
    // Now store the PAN data in UserKYC
    let userKYC = await UserKYC.findOne({ userId });
    
    if (!userKYC) {
      // Create new KYC record if none exists
      userKYC = new UserKYC({
        userId,
        panData: JSON.stringify(ocrResult.data),
        panNumber: panNumber // Store the extracted PAN number
      });
    } else {
      // Update existing KYC record
      userKYC.panData = JSON.stringify(ocrResult.data);
      if (panNumber) {
        userKYC.panNumber = panNumber;
      }
    }
    
    await userKYC.save();
    
    // Update user verification status
    user.isPanVerified = true;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'PAN document processed successfully',
      data: {
        panData: ocrResult.data,
        panNumber: panNumber,
        isPanVerified: true
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
}

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
    
    // Get user KYC data
    const userKYC = await UserKYC.findOne({ userId });
    
    if (!userKYC) {
      return res.status(400).json({
        success: false,
        message: 'KYC records not found. Please complete KYC process first.'
      });
    }
    
    // Check if Aadhaar number is present
    if (!userKYC.aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar number is missing in KYC records. Please verify your Aadhaar again.'
      });
    }
    
    // Check if PAN number is present
    if (!userKYC.panNumber) {
      return res.status(400).json({
        success: false,
        message: 'PAN number is missing in KYC records. Please verify your PAN again.'
      });
    }
    
    // Rest of the API logic for checking Aadhaar-PAN link...
    
  } catch (error) {
    console.error('Error in verifying Aadhaar-PAN link:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

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
    
    // Get user KYC data
    const userKYC = await UserKYC.findOne({ userId });
    
    if (!userKYC) {
      return res.status(400).json({
        success: false,
        message: 'KYC records not found. Please complete KYC process first.'
      });
    }
    
    // Check if Aadhaar number is present
    if (!userKYC.aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar number is missing in KYC records. Please verify your Aadhaar again.'
      });
    }
    
    // Call Surepass API to generate OTP
    const otpRequestData = {
      id_number: userKYC.aadhaarNumber
    };
    
    const otpResult = await postJSON('/api/v1/aadhaar-v2/generate-otp', otpRequestData);
    
    // Debug: Log the OTP generation result
    console.log("Aadhaar OTP Generation Result:", JSON.stringify(otpResult, null, 2));
    
    if (otpResult && otpResult.success) {
      // Store the client_id temporarily in the KYC record for use when submitting OTP
      userKYC.aadhaarClientId = otpResult.data.client_id;
      await userKYC.save();
      
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
}

const verifyAadhaarOTP =  async (req, res) => {
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
      
      // Get user KYC data
      const userKYC = await UserKYC.findOne({ userId });
      
      if (!userKYC) {
        return res.status(400).json({
          success: false,
          message: 'KYC records not found. Please complete KYC process first.'
        });
      }
      
      // Check if Aadhaar number is present
      if (!userKYC.aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number is missing in KYC records. Please verify your Aadhaar again.'
        });
      }
      
      // Check if PAN number is present
      if (!userKYC.panNumber) {
        return res.status(400).json({
          success: false,
          message: 'PAN number is missing in KYC records. Please verify your PAN again.'
        });
      }
      
      // Call Surepass API to check if Aadhaar and PAN are linked
      const verificationData = {
        id_number: userKYC.panNumber,
        aadhaar_number: userKYC.aadhaarNumber,
        consent: "Y",
        consent_text: "I hereby authorize to check if my Aadhaar and PAN are linked"
      };
      
      const linkResult = await postJSON('/api/v1/pan/aadhaar-pan-link-check', verificationData);
      
      // Debug: Log the link verification result
      console.log("Aadhaar-PAN Link Result:", JSON.stringify(linkResult, null, 2));
      
      if (linkResult && linkResult.success) {
        const isLinked = linkResult.data && linkResult.data.linked === true;
        
        if (isLinked) {
          // Update user record to indicate Aadhaar and PAN are linked
          user.isPanAadhaarLinked = true;
          await user.save();
          
          return res.status(200).json({
            success: true,
            message: 'Aadhaar and PAN are linked successfully',
            data: {
              isPanAadhaarLinked: true
            }
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Aadhaar and PAN are not linked to each other',
            data: {
              isPanAadhaarLinked: false
            }
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to verify Aadhaar-PAN link',
          error: linkResult?.error || 'Verification failed'
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
  }


module.exports = {
  registerWithOtp,
  loginWithOtp,
  verifyOtp,
  updateProfileAndProduct,
  aadhaarOCR,
  panOCR,
  aadhaarPanLink,
  generateAadhaarOTP,
  verifyAadhaarOTP
};
