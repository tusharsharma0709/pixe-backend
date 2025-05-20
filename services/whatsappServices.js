// services/whatsappServices.js
// Using your existing implementation with the key function we need for the workflow

const axios = require('axios');
const { makeApiRequest } = require('../utils/whatsappAuth');

// We'll reuse your existing sendMessage function that has good error handling
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
      
      // Return response data
      return response.data;
  } catch (error) {
      console.error(`❌ WHATSAPP SEND ERROR`);
      
      if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`  Status: ${error.response.status}`);
          console.error(`  Response: ${JSON.stringify(error.response.data || {})}`);
      } else if (error.request) {
          // The request was made but no response was received
          console.error(`  No response received`);
      } else {
          // Something happened in setting up the request that triggered an Error
          console.error(`  Error: ${error.message}`);
      }
      
      // Throw enhanced error
      throw error;
  }
};

// Add some additional methods specifically for our KYC workflow

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
        
        return response.data;
    } catch (error) {
        console.error(`❌ WHATSAPP MEDIA SEND ERROR:`, error.message);
        throw error;
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
      console.log(`Sending WhatsApp interactive message to: ${phoneNumber}`);
      
      // Format phone number (remove '+' if present)
      const formattedPhone = phoneNumber.replace(/^\+/, '');
      
      // Limit buttons to 3 (WhatsApp limitation)
      const processedButtons = buttons.slice(0, 3).map(button => ({
          type: "reply",
          reply: {
              id: button.value || button.id,
              title: (button.text || button.title).substring(0, 20) // Max 20 chars
          }
      }));
      
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
      
      // API URL from environment or use default
      const apiUrl = `${process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v22.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      // Make API request
      const response = await axios.post(
          apiUrl,
          payload,
          {
              headers: {
                  'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json'
              }
          }
      );
      
      return response.data;
  } catch (error) {
      console.error('Error sending interactive message:', error.response?.data || error.message);
      throw error;
  }
}

// We'll export the main functions we need for our KYC workflow
module.exports = {
    sendMessage,
    sendMediaMessage,
    sendButtonMessage
};