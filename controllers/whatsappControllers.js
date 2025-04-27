const whatsappService = require('../services/whatsappService');

// 1. Send Message
const sendMessage = async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    const response = await whatsappService.sendMessage(to, message);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// 2. Get Incoming Messages
const getIncomingMessages = async (req, res) => {
  try {
    const messages = await whatsappService.getIncomingMessages();
    res.json(messages);
  } catch (error) {
    console.error('Controller - Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// 3. Send Template Message
const sendTemplateMessage = async (req, res) => {
  try {
    const { to, templateName, templateLanguage = 'en_US' } = req.body;
    
    if (!to || !templateName) {
      return res.status(400).json({ error: 'Phone number and template name are required' });
    }
    
    const response = await whatsappService.sendTemplateMessage(to, templateName, templateLanguage);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send template error:', error);
    res.status(500).json({ error: 'Failed to send template message' });
  }
};

// 4. Get Message Status
const getMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    if (!messageId) {
      return res.status(400).json({ error: 'Message ID is required' });
    }
    
    const status = await whatsappService.getMessageStatus(messageId);
    res.json(status);
  } catch (error) {
    console.error('Controller - Get message status error:', error);
    res.status(500).json({ error: 'Failed to get message status' });
  }
};

// 5. Get Phone Number Info
const getPhoneNumberInfo = async (req, res) => {
  try {
    const info = await whatsappService.getPhoneNumberInfo();
    res.json(info);
  } catch (error) {
    console.error('Controller - Get phone info error:', error);
    res.status(500).json({ error: 'Failed to get phone number information' });
  }
};

// 6. Upload Media
const uploadMedia = async (req, res) => {
  try {
    if (!req.files || !req.files.media) {
      return res.status(400).json({ error: 'Media file is required' });
    }
    
    const { media } = req.files;
    const { type = 'image' } = req.body;
    
    const response = await whatsappService.uploadMedia(media, type);
    res.json(response);
  } catch (error) {
    console.error('Controller - Upload media error:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
};

// 7. List Webhooks
const listWebhooks = async (req, res) => {
  try {
    const webhooks = await whatsappService.listWebhooks();
    res.json(webhooks);
  } catch (error) {
    console.error('Controller - List webhooks error:', error);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
};

// 8. Set Webhook
const setWebhook = async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }
    
    const response = await whatsappService.setWebhook(webhookUrl);
    res.json(response);
  } catch (error) {
    console.error('Controller - Set webhook error:', error);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
};

// 9. Delete Webhook
const deleteWebhook = async (req, res) => {
  try {
    const response = await whatsappService.deleteWebhook();
    res.json(response);
  } catch (error) {
    console.error('Controller - Delete webhook error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

// 10. Get Webhook Status
const getWebhookStatus = async (req, res) => {
  try {
    const status = await whatsappService.getWebhookStatus();
    res.json(status);
  } catch (error) {
    console.error('Controller - Get webhook status error:', error);
    res.status(500).json({ error: 'Failed to get webhook status' });
  }
};

// 11. Get All Contacts
const getContacts = async (req, res) => {
  try {
    const contacts = await whatsappService.getContacts();
    res.json(contacts);
  } catch (error) {
    console.error('Controller - Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
};

// 12. Send Media Message
const sendMediaMessage = async (req, res) => {
  try {
    const { to, mediaUrl, mediaType = 'image' } = req.body;
    
    if (!to || !mediaUrl) {
      return res.status(400).json({ error: 'Phone number and media URL are required' });
    }
    
    const response = await whatsappService.sendMediaMessage(to, mediaUrl, mediaType);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send media message error:', error);
    res.status(500).json({ error: 'Failed to send media message' });
  }
};

// 13. Send File Message
const sendFileMessage = async (req, res) => {
  try {
    const { to, fileUrl, fileType = 'document' } = req.body;
    
    if (!to || !fileUrl) {
      return res.status(400).json({ error: 'Phone number and file URL are required' });
    }
    
    const response = await whatsappService.sendFileMessage(to, fileUrl, fileType);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send file message error:', error);
    res.status(500).json({ error: 'Failed to send file message' });
  }
};

// 14. Get All Templates
const getAllTemplates = async (req, res) => {
  try {
    const templates = await whatsappService.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Controller - Get all templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
};

// 15. Create Template
const createTemplate = async (req, res) => {
  try {
    const { templateName, languageCode, templateData } = req.body;
    
    if (!templateName || !languageCode || !templateData) {
      return res.status(400).json({ error: 'Template name, language code, and template data are required' });
    }
    
    const response = await whatsappService.createTemplate(templateName, languageCode, templateData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

// 16. Update Template
const updateTemplate = async (req, res) => {
  try {
    const { templateName } = req.params;
    const { newTemplateData } = req.body;
    
    if (!templateName || !newTemplateData) {
      return res.status(400).json({ error: 'Template name and new template data are required' });
    }
    
    const response = await whatsappService.updateTemplate(templateName, newTemplateData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

// 17. Delete Template
const deleteTemplate = async (req, res) => {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    const response = await whatsappService.deleteTemplate(templateName);
    res.json(response);
  } catch (error) {
    console.error('Controller - Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

// 18. List All Conversations
const listConversations = async (req, res) => {
  try {
    const conversations = await whatsappService.listConversations();
    res.json(conversations);
  } catch (error) {
    console.error('Controller - List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
};

// 19. Archive Conversation
const archiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const response = await whatsappService.archiveConversation(conversationId);
    res.json(response);
  } catch (error) {
    console.error('Controller - Archive conversation error:', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
};

// 20. Unarchive Conversation
const unarchiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const response = await whatsappService.unarchiveConversation(conversationId);
    res.json(response);
  } catch (error) {
    console.error('Controller - Unarchive conversation error:', error);
    res.status(500).json({ error: 'Failed to unarchive conversation' });
  }
};

// 21. Set Automated Response
const setAutomatedResponse = async (req, res) => {
  try {
    const { responseData } = req.body;
    
    if (!responseData) {
      return res.status(400).json({ error: 'Response data is required' });
    }
    
    const response = await whatsappService.setAutomatedResponse(responseData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Set automated response error:', error);
    res.status(500).json({ error: 'Failed to set automated response' });
  }
};

// 22. Get Automated Responses
const getAutomatedResponses = async (req, res) => {
  try {
    const responses = await whatsappService.getAutomatedResponses();
    res.json(responses);
  } catch (error) {
    console.error('Controller - Get automated responses error:', error);
    res.status(500).json({ error: 'Failed to get automated responses' });
  }
};

// 23. Update Automated Response
const updateAutomatedResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { updatedResponseData } = req.body;
    
    if (!responseId || !updatedResponseData) {
      return res.status(400).json({ error: 'Response ID and updated response data are required' });
    }
    
    const response = await whatsappService.updateAutomatedResponse(responseId, updatedResponseData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Update automated response error:', error);
    res.status(500).json({ error: 'Failed to update automated response' });
  }
};

// 24. Delete Automated Response
const deleteAutomatedResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    
    if (!responseId) {
      return res.status(400).json({ error: 'Response ID is required' });
    }
    
    const response = await whatsappService.deleteAutomatedResponse(responseId);
    res.json(response);
  } catch (error) {
    console.error('Controller - Delete automated response error:', error);
    res.status(500).json({ error: 'Failed to delete automated response' });
  }
};

// 25. Get Group Info
const getGroupInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    const info = await whatsappService.getGroupInfo(groupId);
    res.json(info);
  } catch (error) {
    console.error('Controller - Get group info error:', error);
    res.status(500).json({ error: 'Failed to get group information' });
  }
};

// 26. Create Group
const createGroup = async (req, res) => {
  try {
    const { groupName, participants } = req.body;
    
    if (!groupName || !participants) {
      return res.status(400).json({ error: 'Group name and participants are required' });
    }
    
    const response = await whatsappService.createGroup(groupName, participants);
    res.json(response);
  } catch (error) {
    console.error('Controller - Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

// 27. Add/Remove Members to Group
const addRemoveMembersToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { action, members } = req.body;
    
    if (!groupId || !action || !members) {
      return res.status(400).json({ error: 'Group ID, action, and members are required' });
    }
    
    const response = await whatsappService.addRemoveMembersToGroup(groupId, action, members);
    res.json(response);
  } catch (error) {
    console.error('Controller - Add/remove members error:', error);
    res.status(500).json({ error: 'Failed to modify group members' });
  }
};

// 28. Leave Group
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    const response = await whatsappService.leaveGroup(groupId);
    res.json(response);
  } catch (error) {
    console.error('Controller - Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

// 29. Get Group Messages
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    const messages = await whatsappService.getGroupMessages(groupId);
    res.json(messages);
  } catch (error) {
    console.error('Controller - Get group messages error:', error);
    res.status(500).json({ error: 'Failed to get group messages' });
  }
};

// 30. Send Interactive Message
const sendInteractiveMessage = async (req, res) => {
  try {
    const { to, messageData } = req.body;
    
    if (!to || !messageData) {
      return res.status(400).json({ error: 'Phone number and message data are required' });
    }
    
    const response = await whatsappService.sendInteractiveMessage(to, messageData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send interactive message error:', error);
    res.status(500).json({ error: 'Failed to send interactive message' });
  }
};

// 31. List Message Templates
const listMessageTemplates = async (req, res) => {
  try {
    const templates = await whatsappService.listMessageTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Controller - List message templates error:', error);
    res.status(500).json({ error: 'Failed to list message templates' });
  }
};

// 32. Send Button Message
const sendButtonMessage = async (req, res) => {
  try {
    const { to, buttonsData } = req.body;
    
    if (!to || !buttonsData) {
      return res.status(400).json({ error: 'Phone number and buttons data are required' });
    }
    
    const response = await whatsappService.sendButtonMessage(to, buttonsData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send button message error:', error);
    res.status(500).json({ error: 'Failed to send button message' });
  }
};

// 33. Send Quick Replies
const sendQuickReplies = async (req, res) => {
  try {
    const { to, quickRepliesData } = req.body;
    
    if (!to || !quickRepliesData) {
      return res.status(400).json({ error: 'Phone number and quick replies data are required' });
    }
    
    const response = await whatsappService.sendQuickReplies(to, quickRepliesData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send quick replies error:', error);
    res.status(500).json({ error: 'Failed to send quick replies' });
  }
};

// 34. Get Account Info
const getAccountInfo = async (req, res) => {
  try {
    const info = await whatsappService.getAccountInfo();
    res.json(info);
  } catch (error) {
    console.error('Controller - Get account info error:', error);
    res.status(500).json({ error: 'Failed to get account information' });
  }
};

// 35. Get Profile Info
const getProfileInfo = async (req, res) => {
  try {
    const info = await whatsappService.getProfileInfo();
    res.json(info);
  } catch (error) {
    console.error('Controller - Get profile info error:', error);
    res.status(500).json({ error: 'Failed to get profile information' });
  }
};

// 36. Send Location Message
const sendLocationMessage = async (req, res) => {
  try {
    const { to, latitude, longitude } = req.body;
    
    if (!to || !latitude || !longitude) {
      return res.status(400).json({ error: 'Phone number, latitude, and longitude are required' });
    }
    
    const response = await whatsappService.sendLocationMessage(to, latitude, longitude);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send location message error:', error);
    res.status(500).json({ error: 'Failed to send location message' });
  }
};

// 37. Get Business Info
const getBusinessInfo = async (req, res) => {
  try {
    const info = await whatsappService.getBusinessInfo();
    res.json(info);
  } catch (error) {
    console.error('Controller - Get business info error:', error);
    res.status(500).json({ error: 'Failed to get business information' });
  }
};

// 38. Get Report Data
const getReportData = async (req, res) => {
  try {
    const data = await whatsappService.getReportData();
    res.json(data);
  } catch (error) {
    console.error('Controller - Get report data error:', error);
    res.status(500).json({ error: 'Failed to get report data' });
  }
};

// 39. Send Broadcast Message
const sendBroadcastMessage = async (req, res) => {
  try {
    const { broadcastData } = req.body;
    
    if (!broadcastData) {
      return res.status(400).json({ error: 'Broadcast data is required' });
    }
    
    const response = await whatsappService.sendBroadcastMessage(broadcastData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send broadcast message error:', error);
    res.status(500).json({ error: 'Failed to send broadcast message' });
  }
};

// 40. Check Broadcast Status
const checkBroadcastStatus = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    
    if (!broadcastId) {
      return res.status(400).json({ error: 'Broadcast ID is required' });
    }
    
    const status = await whatsappService.checkBroadcastStatus(broadcastId);
    res.json(status);
  } catch (error) {
    console.error('Controller - Check broadcast status error:', error);
    res.status(500).json({ error: 'Failed to check broadcast status' });
  }
};

// 41. Send Contact Card Message
const sendContactCardMessage = async (req, res) => {
  try {
    const { to, contactData } = req.body;
    
    if (!to || !contactData) {
      return res.status(400).json({ error: 'Phone number and contact data are required' });
    }
    
    const response = await whatsappService.sendContactCardMessage(to, contactData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send contact card message error:', error);
    res.status(500).json({ error: 'Failed to send contact card message' });
  }
};

// 42. Get Group Members
const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    const members = await whatsappService.getGroupMembers(groupId);
    res.json(members);
  } catch (error) {
    console.error('Controller - Get group members error:', error);
    res.status(500).json({ error: 'Failed to get group members' });
  }
};

// 43. Update Business Profile
const updateBusinessProfile = async (req, res) => {
  try {
    const { profileData } = req.body;
    
    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }
    
    const response = await whatsappService.updateBusinessProfile(profileData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Update business profile error:', error);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
};

// 44. Get Message Count
const getMessageCount = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const count = await whatsappService.getMessageCount(startDate, endDate);
    res.json(count);
  } catch (error) {
    console.error('Controller - Get message count error:', error);
    res.status(500).json({ error: 'Failed to get message count' });
  }
};

// 45. Get Media Status
const getMediaStatus = async (req, res) => {
  try {
    const { mediaId } = req.params;
    
    if (!mediaId) {
      return res.status(400).json({ error: 'Media ID is required' });
    }
    
    const status = await whatsappService.getMediaStatus(mediaId);
    res.json(status);
  } catch (error) {
    console.error('Controller - Get media status error:', error);
    res.status(500).json({ error: 'Failed to get media status' });
  }
};

// 46. Get Delivery Report
const getDeliveryReport = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    if (!messageId) {
      return res.status(400).json({ error: 'Message ID is required' });
    }
    
    const report = await whatsappService.getDeliveryReport(messageId);
    res.json(report);
  } catch (error) {
    console.error('Controller - Get delivery report error:', error);
    res.status(500).json({ error: 'Failed to get delivery report' });
  }
};

// 47. Get Customer Segments
const getCustomerSegments = async (req, res) => {
  try {
    const { criteria } = req.body;
    
    if (!criteria) {
      return res.status(400).json({ error: 'Segmentation criteria are required' });
    }
    
    const segments = await whatsappService.getCustomerSegments(criteria);
    res.json(segments);
  } catch (error) {
    console.error('Controller - Get customer segments error:', error);
    res.status(500).json({ error: 'Failed to get customer segments' });
  }
};

// 48. Get Inactive Users
const getInactiveUsers = async (req, res) => {
  try {
    const { period } = req.body;
    
    if (!period) {
      return res.status(400).json({ error: 'Time period is required' });
    }
    
    const users = await whatsappService.getInactiveUsers(period);
    res.json(users);
  } catch (error) {
    console.error('Controller - Get inactive users error:', error);
    res.status(500).json({ error: 'Failed to get inactive users' });
  }
};

// 49. Get Blocked Numbers
const getBlockedNumbers = async (req, res) => {
  try {
    const numbers = await whatsappService.getBlockedNumbers();
    res.json(numbers);
  } catch (error) {
    console.error('Controller - Get blocked numbers error:', error);
    res.status(500).json({ error: 'Failed to get blocked numbers' });
  }
};

// 50. Get Subscription Status
const getSubscriptionStatus = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const status = await whatsappService.getSubscriptionStatus(phoneNumber);
    res.json(status);
  } catch (error) {
    console.error('Controller - Get subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
};

// 51. Get User Preferences
const getUserPreferences = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const preferences = await whatsappService.getUserPreferences(phoneNumber);
    res.json(preferences);
  } catch (error) {
    console.error('Controller - Get user preferences error:', error);
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
};

// 52. Generate QR Code
const generateQRCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const qrCode = await whatsappService.generateQRCode(phoneNumber);
    res.json(qrCode);
  } catch (error) {
    console.error('Controller - Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};

// 53. Send Two-Way Message
const sendTwoWayMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    const response = await whatsappService.sendTwoWayMessage(phoneNumber, message);
    res.json(response);
  } catch (error) {
    console.error('Controller - Send two-way message error:', error);
    res.status(500).json({ error: 'Failed to send two-way message' });
  }
};

// 54. Get Campaign Analytics
const getCampaignAnalytics = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }
    
    const analytics = await whatsappService.getCampaignAnalytics(campaignId);
    res.json(analytics);
  } catch (error) {
    console.error('Controller - Get campaign analytics error:', error);
    res.status(500).json({ error: 'Failed to get campaign analytics' });
  }
};

// 55. Trigger Event
const triggerEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userData } = req.body;
    
    if (!eventId || !userData) {
      return res.status(400).json({ error: 'Event ID and user data are required' });
    }
    
    const response = await whatsappService.triggerEvent(eventId, userData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Trigger event error:', error);
    res.status(500).json({ error: 'Failed to trigger event' });
  }
};

// 56. Integrate with CRM
const integrateWithCRM = async (req, res) => {
  try {
    const { crmData } = req.body;
    
    if (!crmData) {
      return res.status(400).json({ error: 'CRM data is required' });
    }
    
    const response = await whatsappService.integrateWithCRM(crmData);
    res.json(response);
  } catch (error) {
    console.error('Controller - Integrate with CRM error:', error);
    res.status(500).json({ error: 'Failed to integrate with CRM' });
  }
};

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