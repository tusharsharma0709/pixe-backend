// 2. CONTROLLERS
// controllers/whatsappControllers.js
const { User } = require('../models/Users');
const { Campaign } = require('../models/Campaign');
const { Workflow } = require('../models/Workflow');
const { UserSession } = require('../models/UserSession');
const { Admin } = require('../models/Admins');
const { AadhaarVerification } = require('../models/aadhaarVerification');
const { PanVerification } = require('../models/panVerification');
const { BankingVerification } = require('../models/bankVerification');
const axios = require('axios');
require('dotenv').config();

/**
 * ✅ Webhook verification for WhatsApp Business API
 */
const verifyWebhook = (req, res) => {
    // Your verify token (should match the one you set in the Facebook Developer Portal)
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    
    // Parse params from the webhook verification request
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Respond with 200 OK and challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    } else {
        // Responds with '400 Bad Request' if verify tokens do not match
        res.sendStatus(400);
    }
};

/**
 * ✅ Helper function to extract campaign ID from WhatsApp message data
 */
const extractCampaignFromMessage = (data) => {
    // In a real implementation, this would extract campaign info from 
    // referral_id or metadata in the WhatsApp business API payload
    // For this example, we'll look for a specific format or return null
    
    // Check for metadata that might come from a Facebook ad
    if (data.entry?.[0]?.changes?.[0]?.value?.metadata?.referral?.id) {
        return data.entry[0].changes[0].value.metadata.referral.id;
    }
    
    // Look for campaign ID in message text (for testing purposes)
    // Format: "campaign:123456789"
    if (data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body) {
        const text = data.entry[0].changes[0].value.messages[0].text.body;
        const match = text.match(/campaign:([a-f0-9]+)/i);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
};

/**
 * ✅ Helper function to get starting node ID from a workflow
 */
const getStartingNodeId = async (workflowId) => {
    try {
        const workflow = await Workflow.findById(workflowId);
        if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
            return null;
        }
        
        // Find node with type "message" that is intended to be the start
        // In a more complex implementation, you might have a specific "start" node type
        return workflow.nodes[0].nodeId;
    } catch (error) {
        console.error("Error getting starting node:", error);
        return null;
    }
};

/**
 * ✅ Helper function to send WhatsApp message
 */
const sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  try {
      const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      let data = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: mediaUrl ? "image" : "text"
      };
      
      if (mediaUrl) {
          data.image = {
              link: mediaUrl
          };
      } else {
          data.text = {
              preview_url: false,
              body: message
          };
      }
      
      const response = await axios.post(url, data, {
          headers: {
              'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
              'Content-Type': 'application/json'
          }
      });
      
      return response.data;
  } catch (error) {
      console.error("Error sending WhatsApp message:", error.response?.data || error.message);
      throw error;
  }
};

/**
* ✅ Process a workflow node and send appropriate message
*/
const processWorkflowNode = async (session) => {
  try {
      if (!session.workflowId || !session.currentNodeId) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, there was an error processing your request. Please try again later."
          );
      }
      
      // Get the workflow
      const workflow = await Workflow.findById(session.workflowId);
      if (!workflow) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, the workflow you're trying to access doesn't exist."
          );
      }
      
      // Find current node
      const currentNode = workflow.nodes.find(node => node.nodeId === session.currentNodeId);
      if (!currentNode) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, there was an error in the workflow. Please try again later."
          );
      }
      
      // Initialize session data if it doesn't exist
      if (!session.data) {
          session.data = {};
      }
      
      // Add node to completed steps if not already there
      if (!session.stepsCompleted) {
          session.stepsCompleted = [];
      }
      if (!session.stepsCompleted.includes(currentNode.nodeId)) {
          session.stepsCompleted.push(currentNode.nodeId);
          await session.save();
      }
      
      // Get user
      const user = await User.findById(session.userId);
      if (!user) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, user information not found. Please start again."
          );
      }
      
      // Process based on node type
      switch (currentNode.type) {
          case 'message':
              // Simple message node - send the content and move to next node
              await sendWhatsAppMessage(session.phone, currentNode.content);
              
              // Update session with next node if available
              if (currentNode.nextNodeId) {
                  session.currentNodeId = currentNode.nextNodeId;
                  await session.save();
                  
                  // Process next node immediately if it's not an input node
                  const nextNode = workflow.nodes.find(node => node.nodeId === currentNode.nextNodeId);
                  if (nextNode && nextNode.type !== 'input') {
                      return processWorkflowNode(session);
                  }
              } else {
                  // End of workflow
                  session.status = 'completed';
                  await session.save();
              }
              break;
              
          case 'input':
              // Send the question/prompt
              const options = currentNode.options && currentNode.options.length > 0
                  ? '\n\n' + currentNode.options.map((opt, idx) => `${idx + 1}. ${opt.text}`).join('\n')
                  : '';
              
              await sendWhatsAppMessage(session.phone, currentNode.content + options);
              break;
              
          case 'condition':
              // Evaluate condition based on session data
              let nextNodeId = currentNode.nextNodeId; // Default next node
              
              // Simple condition evaluation
              if (currentNode.condition && session.data) {
                  try {
                      // Parse condition (format: "variable operator value")
                      // e.g., "creditScore > 700" or "isVerified == true"
                      const conditionParts = currentNode.condition.match(/([a-zA-Z_]+)\s*([<>=!]+)\s*(.+)/);
                      
                      if (conditionParts && conditionParts.length === 4) {
                          const [_, variable, operator, valueStr] = conditionParts;
                          
                          // Get variable value from session data
                          const variableValue = session.data[variable];
                          
                          // Parse comparison value (handle string, number, boolean)
                          let comparisonValue = valueStr.trim();
                          if (comparisonValue === 'true') comparisonValue = true;
                          else if (comparisonValue === 'false') comparisonValue = false;
                          else if (!isNaN(comparisonValue)) comparisonValue = Number(comparisonValue);
                          
                          // Perform comparison based on operator
                          let conditionResult = false;
                          switch (operator) {
                              case '==':
                                  conditionResult = variableValue == comparisonValue;
                                  break;
                              case '!=':
                                  conditionResult = variableValue != comparisonValue;
                                  break;
                              case '>':
                                  conditionResult = variableValue > comparisonValue;
                                  break;
                              case '<':
                                  conditionResult = variableValue < comparisonValue;
                                  break;
                              case '>=':
                                  conditionResult = variableValue >= comparisonValue;
                                  break;
                              case '<=':
                                  conditionResult = variableValue <= comparisonValue;
                                  break;
                          }
                          
                          // Set next node based on condition result
                          if (conditionResult) {
                              nextNodeId = currentNode.trueNodeId || currentNode.nextNodeId;
                          } else {
                              nextNodeId = currentNode.falseNodeId || currentNode.nextNodeId;
                          }
                      }
                  } catch (error) {
                      console.error("Error evaluating condition:", error);
                      // Use default next node on error
                  }
              }
              
              // Move to next node
              if (nextNodeId) {
                  session.currentNodeId = nextNodeId;
                  await session.save();
                  return processWorkflowNode(session);
              } else {
                  // No next node defined, end workflow
                  session.status = 'completed';
                  await session.save();
              }
              break;
              
          case 'api':
              // Call external API and handle response
              try {
                  let apiResponse;
                  
                  if (currentNode.apiEndpoint) {
                      // Prepare params with session data
                      const params = { ...currentNode.apiParams };
                      
                      // Replace placeholders with actual data
                      // e.g., {phone} becomes the user's phone number
                      if (params) {
                          Object.keys(params).forEach(key => {
                              if (typeof params[key] === 'string' && params[key].startsWith('{') && params[key].endsWith('}')) {
                                  const dataKey = params[key].substring(1, params[key].length - 1);
                                  if (session.data && session.data[dataKey]) {
                                      params[key] = session.data[dataKey];
                                  } else if (dataKey === 'phone') {
                                      params[key] = session.phone;
                                  } else if (dataKey === 'userId') {
                                      params[key] = session.userId;
                                  }
                              }
                          });
                      }
                      
                      // Make API call
                      switch (currentNode.apiMethod) {
                          case 'GET':
                              apiResponse = await axios.get(currentNode.apiEndpoint, { params });
                              break;
                          case 'POST':
                              apiResponse = await axios.post(currentNode.apiEndpoint, params);
                              break;
                          case 'PUT':
                              apiResponse = await axios.put(currentNode.apiEndpoint, params);
                              break;
                          case 'DELETE':
                              apiResponse = await axios.delete(currentNode.apiEndpoint, { params });
                              break;
                          default:
                              throw new Error(`Unsupported API method: ${currentNode.apiMethod}`);
                      }
                      
                      // Store API response in session data
                      session.data.apiResponse = apiResponse.data;
                      await session.save();
                  }
                  
                  // Move to next node
                  if (currentNode.nextNodeId) {
                      session.currentNodeId = currentNode.nextNodeId;
                      await session.save();
                      return processWorkflowNode(session);
                  }
                  
              } catch (error) {
                  console.error("API call error:", error);
                  await sendWhatsAppMessage(
                      session.phone, 
                      "Sorry, there was an error processing your request. Please try again later."
                  );
                  
                  // Move to error node if defined, or end workflow
                  if (currentNode.errorNodeId) {
                      session.currentNodeId = currentNode.errorNodeId;
                      await session.save();
                      return processWorkflowNode(session);
                  } else {
                      session.status = 'abandoned';
                      await session.save();
                  }
              }
              break;
              
          case 'surepass':
              // Handle SurePass API nodes - these are for specific KYC operations
              switch (currentNode.surepassApiType) {
                  case 'aadhaar-ocr':
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Please upload the front and back images of your Aadhaar card. " +
                          "Send them as separate image messages."
                      );
                      break;
                      
                  case 'pan-ocr':
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Please upload an image of your PAN card."
                      );
                      break;
                      
                  case 'aadhaar-otp':
                      // Try to get Aadhaar number from verification record
                      const aadhaarVerification = await AadhaarVerification.findOne({ userId: user._id });
                      
                      if (aadhaarVerification && aadhaarVerification.aadhaarNumber) {
                          // Store in session data
                          session.data.aadhaarNumber = aadhaarVerification.aadhaarNumber;
                          
                          // Call API to generate OTP (mock)
                          await sendWhatsAppMessage(
                              session.phone, 
                              "An OTP has been sent to your Aadhaar-linked mobile number. " +
                              "Please enter the OTP to verify your Aadhaar."
                          );
                      } else {
                          await sendWhatsAppMessage(
                              session.phone, 
                              "Aadhaar information not found. Please complete the Aadhaar OCR step first."
                          );
                          
                          // Go back to error node or default node
                          if (currentNode.errorNodeId) {
                              session.currentNodeId = currentNode.errorNodeId;
                              await session.save();
                              return processWorkflowNode(session);
                          }
                      }
                      break;
                      
                  case 'video-kyc':
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Video KYC is required for verification. Please click the link below to start the video KYC process:\n\n" +
                          `https://videokyc.example.com/session/${user._id}`
                      );
                      break;
                      
                  default:
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Unsupported verification type. Please contact support."
                      );
              }
              break;
              
          case 'bank_verification':
              switch (currentNode.bankVerificationType) {
                  case 'penny-drop':
                      await sendWhatsAppMessage(
                          session.phone, 
                          "To verify your bank account, please provide the following details:\n\n" +
                          "Account Number\nIFSC Code\nAccount Holder Name\n\n" +
                          "Please enter in the format: ACCOUNT:1234567890,IFSC:ABCD0001234,NAME:John Doe"
                      );
                      break;
                      
                  case 'bank-statement':
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Please upload your bank statement for the last 3 months."
                      );
                      break;
                      
                  default:
                      await sendWhatsAppMessage(
                          session.phone, 
                          "Unsupported bank verification method. Please contact support."
                      );
              }
              break;
              
          case 'credit_check':
              // Simulate credit check process
              await sendWhatsAppMessage(
                  session.phone, 
                  "We are checking your credit score. This will take a few moments..."
              );
              
              // Mock credit check result
              setTimeout(async () => {
                  // Generate random credit score between 300 and 900
                  const creditScore = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
                  session.data.creditScore = creditScore;
                  
                  // Save credit score
                  await session.save();
                  
                  // Send result
                  await sendWhatsAppMessage(
                      session.phone, 
                      `Your credit score is ${creditScore}.\n\n` +
                      (creditScore >= 700 
                          ? "Congratulations! You have a good credit score."
                          : "Your credit score is below our threshold for automatic approval.")
                  );
                  
                  // Move to next node
                  if (currentNode.nextNodeId) {
                      session.currentNodeId = currentNode.nextNodeId;
                      await session.save();
                      return processWorkflowNode(session);
                  }
              }, 3000);
              break;
              
          case 'loan_offer':
              // Calculate loan offer based on credit score
              const creditScore = session.data.creditScore || 0;
              let loanAmount = 0;
              let interestRate = 0;
              
              if (creditScore >= 800) {
                  loanAmount = 500000;
                  interestRate = 10.5;
              } else if (creditScore >= 700) {
                  loanAmount = 300000;
                  interestRate = 12.5;
              } else if (creditScore >= 600) {
                  loanAmount = 100000;
                  interestRate = 15;
              } else {
                  loanAmount = 50000;
                  interestRate = 18;
              }
              
              // Store offer in session
              session.data.loanOffer = {
                  amount: loanAmount,
                  interestRate: interestRate,
                  tenure: 24 // months
              };
              
              await session.save();
              
              // Send offer
              await sendWhatsAppMessage(
                  session.phone,
                  `Based on your profile, we are pleased to offer you a loan of Rs. ${loanAmount.toLocaleString('en-IN')} at ${interestRate}% interest rate for 24 months.\n\n` +
                  "Would you like to proceed with this offer?\n\n" +
                  "1. Yes, proceed\n" +
                  "2. No, thank you"
              );
              break;
              
          case 'payment_link':
              // Generate payment link for processing fee
              const processingFee = session.data.loanOffer 
                  ? (session.data.loanOffer.amount * 0.01) // 1% processing fee
                  : 1000; // Default
              
              session.data.processingFee = processingFee;
              
              // Mock payment link
              const paymentLink = `https://pay.example.com/fee/${session.userId}`;
              session.data.paymentLink = paymentLink;
              
              await session.save();
              
              // Send payment link
              await sendWhatsAppMessage(
                  session.phone,
                  `Please pay the processing fee of Rs. ${processingFee.toLocaleString('en-IN')} by clicking on the link below:\n\n` +
                  paymentLink + "\n\n" +
                  "After payment, type 'PAID' to continue."
              );
              break;
              
          case 'document_generate':
              // Generate document
              await sendWhatsAppMessage(
                  session.phone,
                  "We are generating your loan agreement document. This will take a few moments..."
              );
              
              setTimeout(async () => {
                  // Mock document generation
                  const documentUrl = `https://docs.example.com/agreements/${session.userId}`;
                  session.data.documentUrl = documentUrl;
                  
                  await session.save();
                  
                  // Send document link
                  await sendWhatsAppMessage(
                      session.phone,
                      "Your loan agreement has been generated. Please click the link below to download:\n\n" +
                      documentUrl
                  );
                  
                  // Move to next node
                  if (currentNode.nextNodeId) {
                      session.currentNodeId = currentNode.nextNodeId;
                      await session.save();
                      return processWorkflowNode(session);
                  }
              }, 3000);
              break;
              
          case 'make_webhook':
              // Send data to Make.com webhook
              try {
                  if (currentNode.webhookUrl) {
                      // Prepare data to send
                      const webhookData = {
                          userId: session.userId,
                          phone: session.phone,
                          userData: user,
                          sessionData: session.data
                      };
                      
                      // Send to webhook
                      await axios.post(currentNode.webhookUrl, webhookData);
                      
                      // Send confirmation
                      await sendWhatsAppMessage(
                          session.phone,
                          "Your application is being processed. You will receive updates shortly."
                      );
                      
                      // Move to next node
                      if (currentNode.nextNodeId) {
                          session.currentNodeId = currentNode.nextNodeId;
                          await session.save();
                          return processWorkflowNode(session);
                      }
                  } else {
                      throw new Error("Webhook URL not defined");
                  }
              } catch (error) {
                  console.error("Webhook error:", error);
                  await sendWhatsAppMessage(
                      session.phone,
                      "There was an error processing your application. Our team will contact you shortly."
                  );
                  
                  // Move to error node or end workflow
                  if (currentNode.errorNodeId) {
                      session.currentNodeId = currentNode.errorNodeId;
                      await session.save();
                      return processWorkflowNode(session);
                  }
              }
              break;
              
          case 'shipment':
              // Create mock shipment
              const trackingNumber = "TRK" + Math.floor(100000 + Math.random() * 900000);
              session.data.shipment = {
                  trackingNumber,
                  courier: "Express Courier",
                  estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
              };
              
              await session.save();
              
              // Send tracking info
              await sendWhatsAppMessage(
                  session.phone,
                  "Your documents have been dispatched!\n\n" +
                  `Tracking Number: ${trackingNumber}\n` +
                  `Courier: ${session.data.shipment.courier}\n` +
                  `Estimated Delivery: ${session.data.shipment.estimatedDelivery.toDateString()}\n\n` +
                  `Track your shipment here: https://track.example.com/${trackingNumber}`
              );
              
              // Move to next node
              if (currentNode.nextNodeId) {
                  session.currentNodeId = currentNode.nextNodeId;
                  await session.save();
                  return processWorkflowNode(session);
              }
              break;
              
          default:
              await sendWhatsAppMessage(
                  session.phone, 
                  "Unsupported node type. Please contact support."
              );
      }
      
      return true;
  } catch (error) {
      console.error("Error processing workflow node:", error);
      
      // Send error message to user
      try {
          await sendWhatsAppMessage(
              session.phone, 
              "Sorry, there was an error processing your request. Please try again later."
          );
      } catch (msgError) {
          console.error("Error sending error message:", msgError);
      }
      
      // Mark session as abandoned
      try {
          session.status = 'abandoned';
          await session.save();
      } catch (saveError) {
          console.error("Error updating session status:", saveError);
      }
      
      return false;
  }
};

/**
* ✅ Handle user response to workflow step
*/
const handleUserResponse = async (session, messageText, messageType, mediaUrl = null) => {
  try {
      // Get the workflow
      const workflow = await Workflow.findById(session.workflowId);
      if (!workflow) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, the workflow you're trying to access doesn't exist."
          );
      }
      
      // Find current node
      const currentNode = workflow.nodes.find(node => node.nodeId === session.currentNodeId);
      if (!currentNode) {
          return sendWhatsAppMessage(
              session.phone, 
              "Sorry, there was an error in the workflow. Please try again later."
          );
      }
      
      // Handle based on current node type
      switch (currentNode.type) {
          case 'input':
              // Store user input in session data
              if (!session.data) {
                  session.data = {};
              }
              
              // If the node has a variable name, store the input with that name
              if (currentNode.variableName) {
                  session.data[currentNode.variableName] = messageText;
              }
              
              // If the node has options, check if user selected one of them
              if (currentNode.options && currentNode.options.length > 0) {
                  // Check if user sent a number corresponding to an option
                  const optionIndex = parseInt(messageText) - 1;
                  if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < currentNode.options.length) {
                      // User selected an option by number
                      const selectedOption = currentNode.options[optionIndex];
                      session.data[currentNode.variableName + '_text'] = selectedOption.text;
                      
                      // Move to the next node for this option
                      if (selectedOption.nextNodeId) {
                          session.currentNodeId = selectedOption.nextNodeId;
                      } else if (currentNode.nextNodeId) {
                          session.currentNodeId = currentNode.nextNodeId;
                      } else {
                          // No next node defined, end workflow
                          session.status = 'completed';
                      }
                  } else {
                      // User didn't select a valid option number
                      // Try to match text with option text
                      const matchedOption = currentNode.options.find(
                          opt => opt.text.toLowerCase() === messageText.toLowerCase()
                      );
                      
                      if (matchedOption) {
                          // User matched the option text
                          session.data[currentNode.variableName + '_text'] = matchedOption.text;
                          
                          // Move to the next node for this option
                          if (matchedOption.nextNodeId) {
                              session.currentNodeId = matchedOption.nextNodeId;
                          } else if (currentNode.nextNodeId) {
                              session.currentNodeId = currentNode.nextNodeId;
                          } else {
                              // No next node defined, end workflow
                              session.status = 'completed';
                          }
                      } else {
                          // User didn't match any option, ask again
                          await sendWhatsAppMessage(
                              session.phone,
                              "Please select a valid option.\n\n" +
                              currentNode.options.map((opt, idx) => `${idx + 1}. ${opt.text}`).join('\n')
                          );
                          return;
                      }
                  }
              } else {
                  // No options, just move to next node
                  if (currentNode.nextNodeId) {
                      session.currentNodeId = currentNode.nextNodeId;
                  } else {
                      // No next node defined, end workflow
                      session.status = 'completed';
                  }
              }
              
              await session.save();
              
              // Process next node
              return processWorkflowNode(session);
              
          case 'surepass':
              // Handle SurePass-specific nodes
              switch (currentNode.surepassApiType) {
                  case 'aadhaar-ocr':
                      // Handle Aadhaar OCR image responses
                      if (messageType === 'image' && mediaUrl) {
                          // In a real implementation, you would:
                          // 1. Download the image from mediaUrl
                          // 2. Call the SurePass API to process the Aadhaar image
                          // 3. Store the results in the session data
                          
                          // Tracking uploaded images
                          if (!session.data.aadhaarImages) {
                              session.data.aadhaarImages = [];
                          }
                          
                          session.data.aadhaarImages.push(mediaUrl);
                          
                          // If we have both front and back images
                          if (session.data.aadhaarImages.length >= 2) {
                              // Mock Aadhaar data
                              const mockAadhaarData = {
                                  aadhaarNumber: "XXXX XXXX " + Math.floor(1000 + Math.random() * 9000),
                                  name: session.data?.name || "User",
                                  dob: "01/01/1990",
                                  address: "123 Main St, City, State, India"
                              };
                              
                              session.data.aadhaarData = mockAadhaarData;
                              
                              await sendWhatsAppMessage(
                                  session.phone,
                                  "Aadhaar verification successful!\n\n" +
                                  `Name: ${mockAadhaarData.name}\n` +
                                  `Aadhaar: ${mockAadhaarData.aadhaarNumber}\n` +
                                  `DoB: ${mockAadhaarData.dob}`
                              );
                              
                              // Save verification status to User model
                              const user = await User.findById(session.userId);
                              if (user) {
                                  user.isAadhaarVerified = true;
                                  await user.save();
                              }
                              
                              // Move to next node
                              if (currentNode.nextNodeId) {
                                  session.currentNodeId = currentNode.nextNodeId;
                                  await session.save();
                                  return processWorkflowNode(session);
                              }
                          } else {
                              // Still need more images
                              await sendWhatsAppMessage(
                                  session.phone,
                                  "Thanks! Now please send the " + 
                                  (session.data.aadhaarImages.length === 1 ? "back" : "front") + 
                                  " side of your Aadhaar card."
                              );
                          }
                      } else {
                          await sendWhatsAppMessage(
                              session.phone,
                              "Please send a valid image of your Aadhaar card."
                          );
                      }
                      break;
                      
                  case 'pan-ocr':
                      // Handle PAN image response
                      if (messageType === 'image' && mediaUrl) {
                          // Mock PAN data
                          const mockPanData = {
                              panNumber: "ABCDE" + Math.floor(1000 + Math.random() * 9000) + "F",
                              name: session.data?.aadhaarData?.name || "User",
                              dob: session.data?.aadhaarData?.dob || "01/01/1990"
                          };
                          
                          session.data.panData = mockPanData;
                          
                          await sendWhatsAppMessage(
                              session.phone,
                              "PAN verification successful!\n\n" +
                              `Name: ${mockPanData.name}\n` +
                              `PAN: ${mockPanData.panNumber.substring(0, 2) + 'XXXXX' + mockPanData.panNumber.substring(7)}`
                          );
                          
                          // Save verification status to User model
                          const user = await User.findById(session.userId);
                          if (user) {
                              user.isPanVerified = true;
                              await user.save();
                          }
                          
                          // Move to next node
                          if (currentNode.nextNodeId) {
                              session.currentNodeId = currentNode.nextNodeId;
                              await session.save();
                              return processWorkflowNode(session);
                          }
                      } else {
                          await sendWhatsAppMessage(
                              session.phone,
                              "Please send a valid image of your PAN card."
                          );
                      }
                      break;
                      
                  case 'aadhaar-otp':
                      // Handle Aadhaar OTP verification
                      // Simulate OTP verification
                      await sendWhatsAppMessage(
                          session.phone,
                          "OTP verification successful! Your Aadhaar is now fully verified."
                      );
                      
                      // Save validation status to User model
                      const user = await User.findById(session.userId);
                      if (user) {
                          user.isAadhaarValidated = true;
                          await user.save();
                      }
                      
                      // Move to next node
                      if (currentNode.nextNodeId) {
                          session.currentNodeId = currentNode.nextNodeId;
                          await session.save();
                          return processWorkflowNode(session);
                      }
                      break;
                      
                  case 'video-kyc':
                      // For video KYC, we need to wait for an external update
                        await sendWhatsAppMessage(
                            session.phone,
                            "We have received your Video KYC request. Our agent will connect with you shortly."
                        );
                        break;
                        
                    default:
                        await sendWhatsAppMessage(
                            session.phone,
                            "Unsupported verification type. Please contact support."
                        );
                }
                break;
                
            case 'bank_verification':
                if (currentNode.bankVerificationType === 'penny-drop') {
                    // Parse bank details from message
                    // Format expected: ACCOUNT:1234567890,IFSC:ABCD0001234,NAME:John Doe
                    const accountMatch = messageText.match(/ACCOUNT:([^,]+)/i);
                    const ifscMatch = messageText.match(/IFSC:([^,]+)/i);
                    const nameMatch = messageText.match(/NAME:(.+)/i);
                    
                    if (accountMatch && ifscMatch && nameMatch) {
                        const accountNumber = accountMatch[1].trim();
                        const ifscCode = ifscMatch[1].trim();
                        const accountHolderName = nameMatch[1].trim();
                        
                        // Store bank details
                        session.data.bankDetails = {
                            accountNumber,
                            ifscCode,
                            accountHolderName
                        };
                        
                        await session.save();
                        
                        // Simulate penny drop verification
                        await sendWhatsAppMessage(
                            session.phone,
                            "We are verifying your bank account details. This will take a few moments..."
                        );
                        
                        setTimeout(async () => {
                            // Mock successful verification
                            session.data.bankVerified = true;
                            await session.save();
                            
                            // Update bank verification in database
                            const bankingVerification = new BankingVerification({
                                userId: session.userId,
                                accountNumber,
                                ifscCode,
                                bankName: "Bank determined from IFSC",
                                accountHolderName,
                                isVerified: true,
                                verificationMethod: 'penny-drop',
                                verificationDate: new Date()
                            });
                            
                            // Use findOneAndUpdate with upsert to create or update
                            await BankingVerification.findOneAndUpdate(
                                { userId: session.userId },
                                { $set: bankingVerification.toObject() },
                                { upsert: true, new: true }
                            );
                            
                            await sendWhatsAppMessage(
                                session.phone,
                                "Your bank account has been verified successfully!"
                            );
                            
                            // Move to next node
                            if (currentNode.nextNodeId) {
                                session.currentNodeId = currentNode.nextNodeId;
                                await session.save();
                                return processWorkflowNode(session);
                            }
                        }, 3000);
                    } else {
                        await sendWhatsAppMessage(
                            session.phone,
                            "Invalid format. Please provide your bank details in this format:\n\n" +
                            "ACCOUNT:1234567890,IFSC:ABCD0001234,NAME:John Doe"
                        );
                    }
                } else if (currentNode.bankVerificationType === 'bank-statement') {
                    if (messageType === 'document' || messageType === 'image') {
                        // Mock processing of bank statement
                        session.data.bankStatementUrl = mediaUrl;
                        session.data.bankStatementVerified = true;
                        
                        await session.save();
                        
                        await sendWhatsAppMessage(
                            session.phone,
                            "Your bank statement has been received and is being processed. We'll notify you once verification is complete."
                        );
                        
                        // Simulate verification delay
                        setTimeout(async () => {
                            await sendWhatsAppMessage(
                                session.phone,
                                "Your bank statement has been verified successfully!"
                            );
                            
                            // Move to next node
                            if (currentNode.nextNodeId) {
                                session.currentNodeId = currentNode.nextNodeId;
                                await session.save();
                                return processWorkflowNode(session);
                            }
                        }, 5000);
                    } else {
                        await sendWhatsAppMessage(
                            session.phone,
                            "Please upload your bank statement as a document or image."
                        );
                    }
                }
                break;
                
            case 'payment_link':
                // Check if user has confirmed payment
                if (messageText.toUpperCase() === 'PAID') {
                    // Mock payment verification
                    session.data.paymentVerified = true;
                    await session.save();
                    
                    await sendWhatsAppMessage(
                        session.phone,
                        "Thank you! Your payment has been verified. Your application is now being processed."
                    );
                    
                    // Move to next node
                    if (currentNode.nextNodeId) {
                        session.currentNodeId = currentNode.nextNodeId;
                        await session.save();
                        return processWorkflowNode(session);
                    }
                } else {
                    await sendWhatsAppMessage(
                        session.phone,
                        "Please complete the payment using the link provided, then type 'PAID' to continue."
                    );
                }
                break;
                
            case 'shipment':
                // For shipment tracking requests
                if (messageText.toLowerCase().includes('track') || messageText.toLowerCase().includes('status')) {
                    if (session.data.shipment && session.data.shipment.trackingNumber) {
                        await sendWhatsAppMessage(
                            session.phone,
                            `Tracking Status for ${session.data.shipment.trackingNumber}:\n\n` +
                            "Your package is in transit and is expected to be delivered on " +
                            `${session.data.shipment.estimatedDelivery.toDateString()}.`
                        );
                    } else {
                        await sendWhatsAppMessage(
                            session.phone,
                            "We don't have any active shipments for you at the moment."
                        );
                    }
                } else {
                    // For any other messages, continue with workflow
                    if (currentNode.nextNodeId) {
                        session.currentNodeId = currentNode.nextNodeId;
                        await session.save();
                        return processWorkflowNode(session);
                    }
                }
                break;
                
            default:
                // For other node types, just send a message and continue
                await sendWhatsAppMessage(
                    session.phone,
                    "Thank you for your message. Continuing with the process..."
                );
                
                // Continue with current node processing
                return processWorkflowNode(session);
        }
        
    } catch (error) {
        console.error("Error handling user response:", error);
        
        // Send error message to user
        await sendWhatsAppMessage(
            session.phone,
            "Sorry, there was an error processing your response. Please try again later."
        );
        
        return false;
    }
};

/**
 * ✅ Handle incoming WhatsApp webhook
 */
const handleWebhook = async (req, res) => {
    try {
        // Acknowledge the webhook immediately to prevent timeouts
        res.status(200).send('EVENT_RECEIVED');
        
        // Extract message data from WhatsApp webhook payload
        const data = req.body;
        
        if (!data || !data.entry || !data.entry[0] || !data.entry[0].changes || !data.entry[0].changes[0] || 
            !data.entry[0].changes[0].value || !data.entry[0].changes[0].value.messages || 
            !data.entry[0].changes[0].value.messages[0]) {
            console.error("Invalid webhook payload", data);
            return;
        }
        
        const message = data.entry[0].changes[0].value.messages[0];
        const phone = message.from; // User's phone number
        
        // Determine message type and content
        let messageType = message.type;
        let messageText = "";
        let mediaUrl = null;
        
        // Extract content based on message type
        switch (messageType) {
            case 'text':
                messageText = message.text.body || "";
                break;
                
            case 'image':
                mediaUrl = message.image.id; // In reality, you'd need to download this using the Media API
                break;
                
            case 'document':
                mediaUrl = message.document.id;
                break;
                
            // Handle other message types as needed
                
            default:
                console.log(`Unhandled message type: ${messageType}`);
                // Send a message informing the user of supported types
                await sendWhatsAppMessage(
                    phone,
                    "Sorry, we currently only support text, image, and document messages."
                );
                return;
        }
        
        // Find user by phone number
        let user = await User.findOne({ phone });
        
        if (!user) {
            // Extract campaign ID if this is from a campaign
            const campaignId = extractCampaignFromMessage(data);
            
            if (campaignId) {
                // Find campaign
                const campaign = await Campaign.findById(campaignId);
                
                if (!campaign || !campaign.workflowId) {
                    await sendWhatsAppMessage(
                        phone,
                        "Sorry, the campaign you're trying to access doesn't exist or doesn't have a workflow."
                    );
                    return;
                }
                
                // Create new user
                user = new User({
                    phone,
                    campaignId: campaign._id,
                    workflowId: campaign.workflowId
                });
                
                await user.save();
                
                // Create user session
                const startingNodeId = await getStartingNodeId(campaign.workflowId);
                
                if (!startingNodeId) {
                    await sendWhatsAppMessage(
                        phone,
                        "Sorry, there was an error with the workflow configuration. Please try again later."
                    );
                    return;
                }
                
                const session = new UserSession({
                    userId: user._id,
                    phone,
                    campaignId: campaign._id,
                    workflowId: campaign.workflowId,
                    currentNodeId: startingNodeId
                });
                
                await session.save();
                
                // Start the workflow
                await processWorkflowNode(session);
                return;
            } else {
                // Direct message without campaign context
                await sendWhatsAppMessage(
                    phone,
                    "Welcome! Please click on our ad to get started with our service."
                );
                return;
            }
        }
        
        // Find active session for this user
        let session = await UserSession.findOne({
            userId: user._id,
            status: 'active'
        }).sort({ createdAt: -1 });
        
        if (!session) {
            // No active session, check if user has workflow assigned
            if (user.workflowId) {
                // Create a new session
                const startingNodeId = await getStartingNodeId(user.workflowId);
                
                if (!startingNodeId) {
                    await sendWhatsAppMessage(
                        phone,
                        "Sorry, there was an error with the workflow configuration. Please try again later."
                    );
                    return;
                }
                
                session = new UserSession({
                    userId: user._id,
                    phone,
                    campaignId: user.campaignId,
                    workflowId: user.workflowId,
                    currentNodeId: startingNodeId
                });
                
                await session.save();
                
                // Start the workflow
                await processWorkflowNode(session);
                return;
            } else {
                // No workflow assigned, ask user to click on ad
                await sendWhatsAppMessage(
                    phone,
                    "Please click on our ad to get started with our service."
                );
                return;
            }
        }
        
        // Handle user response to current workflow step
        await handleUserResponse(session, messageText, messageType, mediaUrl);
        
    } catch (error) {
        console.error("Error handling webhook:", error);
    }
};

/**
 * ✅ Start WhatsApp flow for a user (API endpoint)
 */
const startWhatsAppFlow = async (req, res) => {
    try {
        const { phone, campaignId } = req.body;
        
        // Validate input
        if (!phone || !campaignId) {
            return res.status(400).json({
                success: false,
                message: "Phone number and campaign ID are required"
            });
        }
        
        // Format phone number (ensure it includes country code)
        const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        
        // Find campaign
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }
        
        // Check if campaign has workflow
        if (!campaign.workflowId) {
            return res.status(400).json({
                success: false,
                message: "Campaign doesn't have a workflow attached"
            });
        }
        
        // Find or create user
        let user = await User.findOne({ phone: formattedPhone });
        
        if (!user) {
            user = new User({
                phone: formattedPhone,
                campaignId,
                workflowId: campaign.workflowId
            });
            
            await user.save();
        } else {
            // Update existing user with campaign and workflow
            user.campaignId = campaignId;
            user.workflowId = campaign.workflowId;
            await user.save();
        }
        
        // Create user session
        const startingNodeId = await getStartingNodeId(campaign.workflowId);
        
        if (!startingNodeId) {
            return res.status(500).json({
                success: false,
                message: "Error with workflow configuration"
            });
        }
        
        // End any existing active sessions
        await UserSession.updateMany(
            { userId: user._id, status: 'active' },
            { status: 'abandoned' }
        );
        
        // Create new session
        const session = new UserSession({
            userId: user._id,
            phone: formattedPhone,
            campaignId,
            workflowId: campaign.workflowId,
            currentNodeId: startingNodeId
        });
        
        await session.save();
        
        // Process first node in background
        processWorkflowNode(session).catch(error => {
            console.error("Error starting workflow:", error);
        });
        
        res.status(200).json({
            success: true,
            message: "WhatsApp flow started successfully",
            data: {
                userId: user._id,
                sessionId: session._id
            }
        });
    } catch (error) {
        console.error("Error starting WhatsApp flow:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get user session status (API endpoint)
 */
const getSessionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await UserSession.findById(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }
        
        // If adminAuth middleware is applied, verify that this admin has access to the session
        if (req.adminId) {
            const workflow = await Workflow.findById(session.workflowId);
            
            if (!workflow || workflow.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this session"
                });
            }
        }
        
        res.status(200).json({
            success: true,
            message: "Session status retrieved successfully",
            data: {
                status: session.status,
                currentNodeId: session.currentNodeId,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                stepsCompleted: session.stepsCompleted
            }
        });
    } catch (error) {
        console.error("Error getting session status:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Get all active sessions for an admin
 */
const getAdminActiveSessions = async (req, res) => {
    try {
        const adminId = req.adminId;
        
        // Get all workflows owned by this admin
        const workflows = await Workflow.find({ adminId });
        const workflowIds = workflows.map(workflow => workflow._id);
        
        // Get all active sessions for these workflows
        const sessions = await UserSession.find({ 
            workflowId: { $in: workflowIds },
            status: 'active'
        })
        .populate('userId', 'phone name email_id')
        .populate('workflowId', 'name')
        .populate('campaignId', 'name')
        .sort({ updatedAt: -1 });
        
        res.status(200).json({
            success: true,
            message: "Active sessions retrieved successfully",
            data: sessions
        });
    } catch (error) {
        console.error("Error getting active sessions:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Send manual message to user
 */
const sendManualMessage = async (req, res) => {
    try {
        const { phone, message } = req.body;
        const adminId = req.adminId;
        
        // Validate input
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                message: "Phone number and message are required"
            });
        }
        
        // Format phone number (ensure it includes country code)
        const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        
        // Verify this user belongs to the admin (optional)
        const user = await User.findOne({ phone: formattedPhone });
        
        if (user) {
            const campaigns = await Campaign.find({ adminId });
            const campaignIds = campaigns.map(campaign => campaign._id.toString());
            
            // Check if user is associated with any of admin's campaigns
            if (user.campaignId && !campaignIds.includes(user.campaignId.toString())) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to message this user"
                });
            }
        }
        
        // Send WhatsApp message
        await sendWhatsAppMessage(formattedPhone, message);
        
        res.status(200).json({
            success: true,
            message: "Message sent successfully"
        });
    } catch (error) {
        console.error("Error sending manual message:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * ✅ Reset user's session and restart workflow
 */
const resetUserSession = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.adminId;
        
        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Verify user belongs to admin
        const campaigns = await Campaign.find({ adminId });
        const campaignIds = campaigns.map(campaign => campaign._id.toString());
        
        if (user.campaignId && !campaignIds.includes(user.campaignId.toString())) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to reset this user's session"
            });
        }
        
        // Verify user has a workflow
        if (!user.workflowId) {
            return res.status(400).json({
                success: false,
                message: "User doesn't have a workflow assigned"
            });
        }
        
        // End any existing active sessions
        await UserSession.updateMany(
            { userId: user._id, status: 'active' },
            { status: 'abandoned' }
        );
        
        // Create new session
        const startingNodeId = await getStartingNodeId(user.workflowId);
        
        if (!startingNodeId) {
            return res.status(500).json({
                success: false,
                message: "Error with workflow configuration"
            });
        }
        
        const session = new UserSession({
            userId: user._id,
            phone: user.phone,
            campaignId: user.campaignId,
            workflowId: user.workflowId,
            currentNodeId: startingNodeId
        });
        
        await session.save();
        
        // Process first node in background
        processWorkflowNode(session).catch(error => {
            console.error("Error restarting workflow:", error);
        });
        
        res.status(200).json({
            success: true,
            message: "User session reset successfully",
            data: {
                sessionId: session._id
            }
        });
    } catch (error) {
        console.error("Error resetting user session:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    verifyWebhook,
    handleWebhook,
    startWhatsAppFlow,
    getSessionStatus,
    getAdminActiveSessions,
    sendManualMessage,
    resetUserSession
};