// services/whatsappServices.js - Enhanced with unified sending function

const axios = require('axios');
const { makeApiRequest } = require('../utils/whatsappAuth');

/**
 * Send a text message via WhatsApp
 * @param {String} phoneNumber - Recipient's phone number
 * @param {String} message - Message content
 * @returns {Promise} - API response
 */
const sendMessage = async (phoneNumber, message) => {
  try {
      console.log(`\n📤 SENDING WHATSAPP MESSAGE`);
      
      // Validate and format inputs
      if (!phoneNumber) {
          throw new Error('Phone number is required');
      }
      
      if (!message) {
          throw new Error('Message content is required');
      }
      
      // Format phone number (remove +, spaces, etc.)
      const phoneStr = String(phoneNumber);
      const formattedPhone = phoneStr.startsWith('+') ? 
          phoneStr.substring(1) : phoneStr.replace(/[^\d]/g, '');
      
      console.log(`  To: ${formattedPhone} (original: ${phoneNumber})`);
      console.log(`  Message: "${message}"`);
      
      // Build request URL and payload
      const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      const payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: {
              body: String(message)
          }
      };

      console.log(`  API URL: ${url}`);
      
      // Send request
      const response = await axios.post(url, payload, {
          headers: {
              'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
              'Content-Type': 'application/json'
          }
      });
      
      console.log(`✅ Message sent successfully`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Response: ${JSON.stringify(response.data)}`);
      
      // Validate response
      if (!response.data.messages || response.data.messages.length === 0) {
          console.error('⚠️ No message ID returned in response');
          throw new Error('Invalid response: No message ID returned');
      }
      
      // Return standardized response
      return {
          success: true,
          data: response.data,
          messageId: response.data.messages[0].id
      };
  } catch (error) {
      console.error(`❌ WHATSAPP SEND ERROR`);
      
      if (error.response) {
          console.error(`  Status: ${error.response.status}`);
          console.error(`  Response: ${JSON.stringify(error.response.data || {})}`);
      } else if (error.request) {
          console.error(`  No response received`);
      } else {
          console.error(`  Error: ${error.message}`);
      }
      
      // Return standardized error response
      return {
          success: false,
          error: error.message,
          details: error.response?.data || null
      };
  }
};

/**
 * Send a media message via WhatsApp
 * @param {String} phoneNumber - Recipient's phone number
 * @param {String} mediaUrl - URL of media file
 * @param {String} caption - Optional caption for the media
 * @param {String} mediaType - Type of media (image, document, video, etc.)
 * @returns {Promise} - API response
 */
const sendMediaMessage = async (phoneNumber, mediaUrl, caption = '', mediaType = 'image') => {
    try {
        // Format phone number
        const phoneStr = String(phoneNumber);
        const formattedPhone = phoneStr.startsWith('+') ? 
            phoneStr.substring(1) : phoneStr.replace(/[^\d]/g, '');
        
        console.log(`\n📤 SENDING WHATSAPP MEDIA`);
        console.log(`  To: ${formattedPhone}`);
        console.log(`  Media type: ${mediaType}`);
        console.log(`  Media URL: ${mediaUrl}`);
        
        // Build request URL and payload
        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const payload = {
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: mediaType
        };
        
        // Add media data based on type
        if (mediaType === 'image') {
            payload.image = { 
                link: mediaUrl,
                caption: caption
            };
        } else if (mediaType === 'document') {
            payload.document = { 
                link: mediaUrl,
                caption: caption
            };
        } else if (mediaType === 'video') {
            payload.video = { 
                link: mediaUrl,
                caption: caption
            };
        }
        
        // Send request
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Media message sent successfully`);
        
        return {
            success: true,
            data: response.data,
            messageId: response.data.messages[0].id
        };
    } catch (error) {
        console.error(`❌ WHATSAPP MEDIA SEND ERROR:`, error.message);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Send a WhatsApp message with interactive buttons
 * @param {String} phoneNumber - The recipient's phone number
 * @param {String} bodyText - The message text
 * @param {Array} buttons - Array of button objects with text and value
 * @returns {Promise<Object>} - WhatsApp API response
 */
async function sendButtonMessage(phoneNumber, bodyText, buttons) {
  try {
      console.log(`\n📤 SENDING WHATSAPP INTERACTIVE MESSAGE`);
      console.log(`  To: ${phoneNumber}`);
      console.log(`  Message: "${bodyText}"`);
      
      // Format phone number (remove +, spaces, etc.)
      const phoneStr = String(phoneNumber);
      const formattedPhone = phoneStr.startsWith('+') ? 
          phoneStr.substring(1) : phoneStr.replace(/[^\d]/g, '');
      
      // Limit buttons to 3 (WhatsApp limitation)
      const processedButtons = buttons.slice(0, 3).map(button => ({
          type: "reply",
          reply: {
              id: String(button.value || button.id || "option").substring(0, 256),
              title: String(button.text || button.title || "Option").substring(0, 20)
          }
      }));
      
      console.log(`  Processed ${processedButtons.length} buttons for WhatsApp API`);
      
      // Create message payload
      const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "interactive",
          interactive: {
              type: "button",
              body: {
                  text: bodyText
              },
              action: {
                  buttons: processedButtons
              }
          }
      };
      
      // Get API URL and token
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
      
      if (!phoneNumberId) {
          throw new Error('WHATSAPP_PHONE_NUMBER_ID not configured in environment');
      }
      
      if (!accessToken) {
          throw new Error('WhatsApp access token not configured in environment');
      }
      
      // API URL
      const apiUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
      
      console.log(`  Using API URL: ${apiUrl}`);
      
      // Make API request
      const response = await axios.post(
          apiUrl,
          payload,
          {
              headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
              }
          }
      );
      
      console.log(`✅ Message sent successfully`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Response:`, response.data);
      
      return {
          success: true,
          data: response.data,
          messageId: response.data.messages[0].id
      };
  } catch (error) {
      console.error(`❌ WHATSAPP INTERACTIVE MESSAGE ERROR`);
      
      if (error.response) {
          console.error(`  Status: ${error.response.status}`);
          console.error(`  Response:`, error.response.data);
      } else if (error.request) {
          console.error(`  No response received`);
      } else {
          console.error(`  Error: ${error.message}`);
      }
      
      return {
          success: false,
          error: error.message,
          details: error.response?.data || null
      };
  }
}

/**
 * UNIFIED WHATSAPP SENDER - Main function to handle all message types
 * @param {String} phoneNumber - Recipient's phone number
 * @param {String} content - Message content
 * @param {String} messageType - Type of message ('text', 'image', 'document', 'video', 'interactive')
 * @param {String} mediaUrl - URL for media messages (optional)
 * @param {Array} buttons - Buttons for interactive messages (optional)
 * @returns {Promise<Object>} - Standardized response
 */
const sendWhatsAppMessage = async (phoneNumber, content, messageType = 'text', mediaUrl = null, buttons = null) => {
    try {
        console.log(`\n🔄 UNIFIED WHATSAPP SENDER`);
        console.log(`  Phone: ${phoneNumber}`);
        console.log(`  Type: ${messageType}`);
        console.log(`  Content: "${content}"`);
        
        let result;
        
        switch (messageType.toLowerCase()) {
            case 'text':
                result = await sendMessage(phoneNumber, content);
                break;
                
            case 'image':
            case 'document':
            case 'video':
                if (!mediaUrl) {
                    throw new Error(`Media URL is required for ${messageType} messages`);
                }
                result = await sendMediaMessage(phoneNumber, mediaUrl, content, messageType);
                break;
                
            case 'interactive':
            case 'buttons':
                if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
                    throw new Error('Buttons array is required for interactive messages');
                }
                result = await sendButtonMessage(phoneNumber, content, buttons);
                break;
                
            default:
                throw new Error(`Unsupported message type: ${messageType}`);
        }
        
        console.log(`✅ UNIFIED SENDER RESULT: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        return result;
        
    } catch (error) {
        console.error(`❌ UNIFIED SENDER ERROR: ${error.message}`);
        return {
            success: false,
            error: error.message,
            details: null
        };
    }
};

// Export all functions
module.exports = {
    sendMessage,
    sendMediaMessage,
    sendButtonMessage,
    sendWhatsAppMessage  // ← This is the main function for your API
};