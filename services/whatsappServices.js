const { makeApiRequest } = require('../utils/whatsappAuth');
const axios=require('axios')


// 1. Send Message API
// const sendMessage = async (to, message) => {
//   const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
//   const data = {
//     messaging_product: "whatsapp",
//     to,
//     text: { body: message }
//   };
//   return makeApiRequest(url, 'POST', data);
// };

// 2. Receive Incoming Message API
const getIncomingMessages = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  return makeApiRequest(url, 'GET');
};

// 3. Send Template Message API
const sendTemplateMessage = async (to, templateName, templateLanguage) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    template: {
      name: templateName,
      language: { code: templateLanguage }
    }
  };
  return makeApiRequest(url, 'POST', data);
};

// 4. Get Message Status API
const getMessageStatus = async (messageId) => {
  const url = `https://graph.facebook.com/v14.0/${messageId}`;
  return makeApiRequest(url, 'GET');
};

// 5. Get Phone Number Info API
const getPhoneNumberInfo = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}`;
  return makeApiRequest(url, 'GET');
};

// 6. Media Upload API
const uploadMedia = async (mediaFile, type = 'image') => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/media`;
  const formData = new FormData();
  formData.append('file', mediaFile);
  formData.append('type', type);
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
    'Content-Type': 'multipart/form-data'
  };

  const response = await axios.post(url, formData, { headers });
  return response.data;
};

// 7. List Webhooks API
const listWebhooks = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/webhooks`;
  return makeApiRequest(url, 'GET');
};

// 8. Set Webhook API
const setWebhook = async (webhookUrl) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/webhooks`;
  const data = { url: webhookUrl };
  return makeApiRequest(url, 'POST', data);
};

// 9. Delete Webhook API
const deleteWebhook = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/webhooks`;
  return makeApiRequest(url, 'DELETE');
};

// 10. Get Webhook Status API
const getWebhookStatus = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/webhooks`;
  return makeApiRequest(url, 'GET');
};

// 11. Get All Contacts API
const getContacts = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/contacts`;
  return makeApiRequest(url, 'GET');
};

// 12. Send Media Message API
const sendMediaMessage = async (to, mediaUrl, mediaType = 'image') => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    type: mediaType,
    [mediaType]: { link: mediaUrl }
  };
  return makeApiRequest(url, 'POST', data);
};

// 13. Send File Message API
const sendFileMessage = async (to, fileUrl, fileType = 'document') => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    type: fileType,
    [fileType]: { link: fileUrl }
  };
  return makeApiRequest(url, 'POST', data);
};

// 14. Get All Templates API
const getAllTemplates = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/message_templates`;
  return makeApiRequest(url, 'GET');
};

// 15. Create Template API
const createTemplate = async (templateName, languageCode, templateData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/message_templates`;
  const data = {
    name: templateName,
    language: { code: languageCode },
    components: templateData
  };
  return makeApiRequest(url, 'POST', data);
};

// 16. Update Template API
const updateTemplate = async (templateName, newTemplateData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/message_templates/${templateName}`;
  const data = { components: newTemplateData };
  return makeApiRequest(url, 'PATCH', data);
};

// 17. Delete Template API
const deleteTemplate = async (templateName) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/message_templates/${templateName}`;
  return makeApiRequest(url, 'DELETE');
};

// 18. List All Conversations API
const listConversations = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/conversations`;
  return makeApiRequest(url, 'GET');
};

// 19. Archive Conversation API
const archiveConversation = async (conversationId) => {
  const url = `https://graph.facebook.com/v14.0/${conversationId}/archive`;
  return makeApiRequest(url, 'POST');
};

// 20. Unarchive Conversation API
const unarchiveConversation = async (conversationId) => {
  const url = `https://graph.facebook.com/v14.0/${conversationId}/unarchive`;
  return makeApiRequest(url, 'POST');
};

// 21. Set Automated Responses API
const setAutomatedResponse = async (responseData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/automated_responses`;
  const data = { ...responseData };
  return makeApiRequest(url, 'POST', data);
};

// 22. Get Automated Responses API
const getAutomatedResponses = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/automated_responses`;
  return makeApiRequest(url, 'GET');
};

// 23. Update Automated Response API
const updateAutomatedResponse = async (responseId, updatedResponseData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/automated_responses/${responseId}`;
  const data = { ...updatedResponseData };
  return makeApiRequest(url, 'PATCH', data);
};

// 24. Delete Automated Response API
const deleteAutomatedResponse = async (responseId) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/automated_responses/${responseId}`;
  return makeApiRequest(url, 'DELETE');
};

// 25. Get Group Info API
const getGroupInfo = async (groupId) => {
  const url = `https://graph.facebook.com/v14.0/${groupId}`;
  return makeApiRequest(url, 'GET');
};

// 26. Create Group API
const createGroup = async (groupName, participants) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/groups`;
  const data = {
    name: groupName,
    participants: participants
  };
  return makeApiRequest(url, 'POST', data);
};

// 27. Add/Remove Members to Group API
const addRemoveMembersToGroup = async (groupId, action, members) => {
  const url = `https://graph.facebook.com/v14.0/${groupId}/members`;
  const data = { action, participants: members };
  return makeApiRequest(url, 'POST', data);
};

// 28. Leave Group API
const leaveGroup = async (groupId) => {
  const url = `https://graph.facebook.com/v14.0/${groupId}/leave`;
  return makeApiRequest(url, 'POST');
};

// 29. Get Group Messages API
const getGroupMessages = async (groupId) => {
  const url = `https://graph.facebook.com/v14.0/${groupId}/messages`;
  return makeApiRequest(url, 'GET');
};

// 30. Send Interactive Messages API
const sendInteractiveMessage = async (to, messageData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    interactive: messageData
  };
  return makeApiRequest(url, 'POST', data);
};

// 31. List Message Templates API
const listMessageTemplates = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/message_templates`;
  return makeApiRequest(url, 'GET');
};

// 32. Send Button Messages API
const sendButtonMessage = async (to, buttonsData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    interactive: { type: "button", body: { text: "Choose an option" }, action: { buttons: buttonsData } }
  };
  return makeApiRequest(url, 'POST', data);
};

// 33. Send Quick Replies API
const sendQuickReplies = async (to, quickRepliesData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    interactive: { type: "quick_reply", body: { text: "Choose an option" }, action: { quick_replies: quickRepliesData } }
  };
  return makeApiRequest(url, 'POST', data);
};

// 34. Get Account Info API
const getAccountInfo = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}`;
  return makeApiRequest(url, 'GET');
};

// 35. Get Profile Info API
const getProfileInfo = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/profile`;
  return makeApiRequest(url, 'GET');
};

// 36. Send Location Message API
const sendLocationMessage = async (to, latitude, longitude) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    type: "location",
    location: { latitude, longitude }
  };
  return makeApiRequest(url, 'POST', data);
};

// 37. Get Business Info API
const getBusinessInfo = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/business_info`;
  return makeApiRequest(url, 'GET');
};

// 38. Get Report Data API
const getReportData = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/reports`;
  return makeApiRequest(url, 'GET');
};

// 39. Send Broadcast Message API
const sendBroadcastMessage = async (broadcastData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/broadcast`;
  return makeApiRequest(url, 'POST', broadcastData);
};

// 40. Check Broadcast Status API
const checkBroadcastStatus = async (broadcastId) => {
  const url = `https://graph.facebook.com/v14.0/${broadcastId}`;
  return makeApiRequest(url, 'GET');
};

// 41. Send Contact Card Message API
const sendContactCardMessage = async (to, contactData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to,
    type: "contacts",
    contacts: [contactData]
  };
  return makeApiRequest(url, 'POST', data);
};

// 42. Get Group Members API
const getGroupMembers = async (groupId) => {
  const url = `https://graph.facebook.com/v14.0/${groupId}/members`;
  return makeApiRequest(url, 'GET');
};

// 43. Update Business Profile API
const updateBusinessProfile = async (profileData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/profile`;
  const data = profileData;
  return makeApiRequest(url, 'PATCH', data);
};

// ========== Message Count ==========

const getMessageCount = async (startDate, endDate) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages/count`;
  const data = { startDate, endDate };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error getting message count:", error);
  }
};

// ========== Media Status ==========

const getMediaStatus = async (mediaId) => {
  const url = `https://graph.facebook.com/v14.0/${mediaId}/status`;
  try {
    return await makeApiRequest(url, 'GET');
  } catch (error) {
    console.error("Error getting media status:", error);
  }
};

// ========== Delivery Report ==========

const getDeliveryReport = async (messageId) => {
  const url = `https://graph.facebook.com/v14.0/${messageId}/delivery_report`;
  try {
    return await makeApiRequest(url, 'GET');
  } catch (error) {
    console.error("Error getting delivery report:", error);
  }
};

// ========== Customer Segmentation ==========

const getCustomerSegments = async (criteria) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/customer_segments`;
  const data = { criteria };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error getting customer segments:", error);
  }
};

// ========== Inactive Users ==========

const getInactiveUsers = async (period) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/inactive_users`;
  const data = { period };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error getting inactive users:", error);
  }
};

// ========== Blocked Numbers ==========

const getBlockedNumbers = async () => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/blocked_numbers`;
  try {
    return await makeApiRequest(url, 'GET');
  } catch (error) {
    console.error("Error getting blocked numbers:", error);
  }
};

// ========== Subscription Status ==========

const getSubscriptionStatus = async (phoneNumber) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/subscription_status`;
  const data = { phoneNumber };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error getting subscription status:", error);
  }
};

// ========== User Preferences ==========

const getUserPreferences = async (phoneNumber) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/preferences`;
  const data = { phoneNumber };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error getting user preferences:", error);
  }
};

// ========== Generate QR Code for WhatsApp Chat ==========

const generateQRCode = async (phoneNumber) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/qr_code`;
  const data = { phoneNumber };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error generating QR code:", error);
  }
};

// ========== Two-Way Messaging ==========

const sendTwoWayMessage = async (phoneNumber, message) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    text: { body: message }
  };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error sending two-way message:", error);
  }
};

// ========== Analytics for Campaigns ==========

const getCampaignAnalytics = async (campaignId) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/campaigns/${campaignId}/analytics`;
  try {
    return await makeApiRequest(url, 'GET');
  } catch (error) {
    console.error("Error getting campaign analytics:", error);
  }
};

// ========== Event Trigger ==========

const triggerEvent = async (eventId, userData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/events/${eventId}/trigger`;
  const data = { userData };
  try {
    return await makeApiRequest(url, 'POST', data);
  } catch (error) {
    console.error("Error triggering event:", error);
  }
};

// ========== Integrate with CRM System ==========

const integrateWithCRM = async (crmData) => {
  const url = `https://graph.facebook.com/v14.0/${process.env.WHATSAPP_PHONE_ID}/crm/integrate`;
  try {
    return await makeApiRequest(url, 'POST', crmData);
  } catch (error) {
    console.error("Error integrating with CRM:", error);
  }
};

// services/whatsappService.js
// Update your sendMessage function in whatsappServices.js
const sendMessage = async (phoneNumber, message) => {
  try {
      const phoneStr = String(phoneNumber);
      const formattedPhone = phoneStr.startsWith('+') ? phoneStr : `+${phoneStr}`;
      
      const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      const payload = {
          messaging_product: "whatsapp",
          to: formattedPhone.replace('+', ''),
          type: "text",
          text: {
              body: String(message)
          }
      };

      console.log('\n=== WhatsApp API Request ===');
      console.log('Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
      console.log('To:', formattedPhone.replace('+', ''));
      console.log('Message:', message);

      const response = await axios.post(url, payload, {
          headers: {
              'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
              'Content-Type': 'application/json'
          }
      });
      
      console.log('\n=== WhatsApp API Response ===');
      console.log('Status:', response.status);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      console.log('Message ID:', response.data.messages?.[0]?.id);
      console.log('Contacts:', response.data.contacts);
      
      // Check if message was actually accepted
      if (!response.data.messages || response.data.messages.length === 0) {
          console.error('WARNING: No message ID returned!');
      }
      
      return response.data;
  } catch (error) {
      console.error('\n=== WhatsApp API Error ===');
      console.error('Status:', error.response?.status);
      console.error('Error:', error.response?.data);
      throw error;
  }
}


module.exports = {
  sendMessage,
  getIncomingMessages,
  sendTemplateMessage,
  getMessageStatus,
  getPhoneNumberInfo,
  uploadMedia,
  listWebhooks,
  setWebhook,
  deleteWebhook,
  getWebhookStatus,
  getContacts,
  sendMediaMessage,
  sendFileMessage,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listConversations,
  archiveConversation,
  unarchiveConversation,
  setAutomatedResponse,
  getAutomatedResponses,
  updateAutomatedResponse,
  deleteAutomatedResponse,
  getGroupInfo,
  createGroup,
  addRemoveMembersToGroup,
  leaveGroup,
  getGroupMessages,
  sendInteractiveMessage,
  listMessageTemplates,
  sendButtonMessage,
  sendQuickReplies,
  getAccountInfo,
  getProfileInfo,
  sendLocationMessage,
  getBusinessInfo,
  getReportData,
  sendBroadcastMessage,
  checkBroadcastStatus,
  sendContactCardMessage,
  getGroupMembers,
  updateBusinessProfile,
    getMessageCount,
  getMediaStatus,
  getDeliveryReport,
  getCustomerSegments,
  getInactiveUsers,
  getBlockedNumbers,
  getSubscriptionStatus,
  getUserPreferences,
  generateQRCode,
  sendTwoWayMessage,
  getCampaignAnalytics,
  triggerEvent,
  integrateWithCRM,
};
