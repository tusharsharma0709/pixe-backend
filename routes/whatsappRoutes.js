const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappControllers');


// 1. Send Message API
router.post('/message/send', whatsappController.sendMessage);

// 2. Receive Incoming Message API
router.get('/messages', whatsappController.getIncomingMessages);

// 3. Send Template Message API
router.post('/message/template', whatsappController.sendTemplateMessage);

// 4. Get Message Status API
router.get('/message/status/:messageId', whatsappController.getMessageStatus);

// 5. Get Phone Number Info API
router.get('/phone/info', whatsappController.getPhoneNumberInfo);

// 6. Media Upload API
router.post('/media/upload', whatsappController.uploadMedia);

// 7. List Webhooks API
router.get('/webhooks', whatsappController.listWebhooks);

// 8. Set Webhook API
router.post('/webhook', whatsappController.setWebhook);

// 9. Delete Webhook API
router.delete('/webhook', whatsappController.deleteWebhook);

// 10. Get Webhook Status API
router.get('/webhook/status', whatsappController.getWebhookStatus);

// 11. Get All Contacts API
router.get('/contacts', whatsappController.getContacts);

// 12. Send Media Message API
router.post('/message/media', whatsappController.sendMediaMessage);

// 13. Send File Message API
router.post('/message/file', whatsappController.sendFileMessage);

// 14. Get All Templates API
router.get('/templates', whatsappController.getAllTemplates);

// 15. Create Template API
router.post('/template', whatsappController.createTemplate);

// 16. Update Template API
router.patch('/template/:templateName', whatsappController.updateTemplate);

// 17. Delete Template API
router.delete('/template/:templateName', whatsappController.deleteTemplate);

// 18. List All Conversations API
router.get('/conversations', whatsappController.listConversations);

// 19. Archive Conversation API
router.post('/conversation/:conversationId/archive', whatsappController.archiveConversation);

// 20. Unarchive Conversation API
router.post('/conversation/:conversationId/unarchive', whatsappController.unarchiveConversation);

// 21. Set Automated Responses API
router.post('/automated-response', whatsappController.setAutomatedResponse);

// 22. Get Automated Responses API
router.get('/automated-responses', whatsappController.getAutomatedResponses);

// 23. Update Automated Response API
router.patch('/automated-response/:responseId', whatsappController.updateAutomatedResponse);

// 24. Delete Automated Response API
router.delete('/automated-response/:responseId', whatsappController.deleteAutomatedResponse);

// 25. Get Group Info API
router.get('/group/:groupId', whatsappController.getGroupInfo);

// 26. Create Group API
router.post('/group', whatsappController.createGroup);

// 27. Add/Remove Members to Group API
router.post('/group/:groupId/members', whatsappController.addRemoveMembersToGroup);

// 28. Leave Group API
router.post('/group/:groupId/leave', whatsappController.leaveGroup);

// 29. Get Group Messages API
router.get('/group/:groupId/messages', whatsappController.getGroupMessages);

// 30. Send Interactive Messages API
router.post('/message/interactive', whatsappController.sendInteractiveMessage);

// 31. List Message Templates API
router.get('/message-templates', whatsappController.listMessageTemplates);

// 32. Send Button Messages API
router.post('/message/button', whatsappController.sendButtonMessage);

// 33. Send Quick Replies API
router.post('/message/quick-replies', whatsappController.sendQuickReplies);

// 34. Get Account Info API
router.get('/account/info', whatsappController.getAccountInfo);

// 35. Get Profile Info API
router.get('/profile/info', whatsappController.getProfileInfo);

// 36. Send Location Message API
router.post('/message/location', whatsappController.sendLocationMessage);

// 37. Get Business Info API
router.get('/business/info', whatsappController.getBusinessInfo);

// 38. Get Report Data API
router.get('/reports', whatsappController.getReportData);

// 39. Send Broadcast Message API
router.post('/broadcast', whatsappController.sendBroadcastMessage);

// 40. Check Broadcast Status API
router.get('/broadcast/:broadcastId', whatsappController.checkBroadcastStatus);

// 41. Send Contact Card Message API
router.post('/message/contact-card', whatsappController.sendContactCardMessage);

// 42. Get Group Members API
router.get('/group/:groupId/members', whatsappController.getGroupMembers);

// 43. Update Business Profile API
router.patch('/business/profile', whatsappController.updateBusinessProfile);

// 44. Get Message Count API
router.post('/messages/count', whatsappController.getMessageCount);

// 45. Get Media Status API
router.get('/media/:mediaId/status', whatsappController.getMediaStatus);

// 46. Get Delivery Report API
router.get('/message/:messageId/delivery-report', whatsappController.getDeliveryReport);

// 47. Get Customer Segments API
router.post('/customers/segments', whatsappController.getCustomerSegments);

// 48. Get Inactive Users API
router.post('/customers/inactive', whatsappController.getInactiveUsers);

// 49. Get Blocked Numbers API
router.get('/contacts/blocked', whatsappController.getBlockedNumbers);

// 50. Get Subscription Status API
router.post('/subscription/status', whatsappController.getSubscriptionStatus);

// 51. Get User Preferences API
router.post('/user/preferences', whatsappController.getUserPreferences);

// 52. Generate QR Code API
router.post('/qr-code', whatsappController.generateQRCode);

// 53. Two-Way Messaging API
router.post('/message/two-way', whatsappController.sendTwoWayMessage);

// 54. Campaign Analytics API
router.get('/campaign/:campaignId/analytics', whatsappController.getCampaignAnalytics);

// 55. Event Trigger API
router.post('/event/:eventId/trigger', whatsappController.triggerEvent);

// 56. Integrate with CRM API
router.post('/crm/integrate', whatsappController.integrateWithCRM);

module.exports = router;