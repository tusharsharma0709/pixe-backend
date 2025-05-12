// utils/facebookAuth.js
const axios = require('axios');

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v18.0';
const FACEBOOK_GRAPH_URL = 'https://graph.facebook.com';

/**
 * Verify Facebook credentials
 * NOTE: In production, you should use OAuth flow, not direct password verification
 */
const verifyFacebookCredentials = async (fb_id, fb_password) => {
    try {
        // IMPORTANT: Direct password verification is not recommended and not supported by Facebook.
        // This is a placeholder implementation. In production, you should:
        // 1. Use Facebook OAuth 2.0 flow
        // 2. Get access tokens through proper authorization
        // 3. Never store or handle Facebook passwords directly

        if (!fb_id || !fb_password) {
            return {
                success: false,
                error: "Facebook ID and password are required"
            };
        }

        // Simulate API call delay for development
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In a real implementation, you would:
        // 1. Redirect user to Facebook OAuth page
        // 2. Get authorization code
        // 3. Exchange code for access token
        // 4. Verify the token with Facebook

        // For development purposes, simulating successful verification
        const mockAccessToken = `mock_access_token_${Date.now()}`;
        const mockRefreshToken = `mock_refresh_token_${Date.now()}`;
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        return {
            success: true,
            accessToken: mockAccessToken,
            refreshToken: mockRefreshToken,
            expiresAt: expiresAt,
            userId: fb_id
        };

    } catch (error) {
        console.error("Error verifying Facebook credentials:", error);
        return {
            success: false,
            error: error.message || "Failed to verify Facebook credentials"
        };
    }
};

/**
 * Exchange authorization code for access token
 * This is the proper way to get Facebook access tokens
 */
const exchangeCodeForToken = async (code, redirectUri) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/oauth/access_token`;
        
        const params = {
            client_id: FACEBOOK_APP_ID,
            client_secret: FACEBOOK_APP_SECRET,
            redirect_uri: redirectUri,
            code: code
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type
        };
    } catch (error) {
        console.error("Error exchanging code for token:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Get long-lived access token from short-lived token
 */
const getLongLivedToken = async (shortLivedToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/oauth/access_token`;
        
        const params = {
            grant_type: 'fb_exchange_token',
            client_id: FACEBOOK_APP_ID,
            client_secret: FACEBOOK_APP_SECRET,
            fb_exchange_token: shortLivedToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type
        };
    } catch (error) {
        console.error("Error getting long-lived token:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Refresh Facebook access token
 */
const refreshFacebookToken = async (refreshToken) => {
    try {
        // Facebook doesn't use refresh tokens in the traditional OAuth sense
        // Instead, you need to use the long-lived token mechanism
        
        // For development purposes
        await new Promise(resolve => setTimeout(resolve, 500));

        const newAccessToken = `refreshed_token_${Date.now()}`;
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        return {
            success: true,
            accessToken: newAccessToken,
            expiresAt: expiresAt
        };
    } catch (error) {
        console.error("Error refreshing Facebook token:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get Facebook page access token
 */
const getFacebookPageToken = async (userAccessToken, pageId) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/${pageId}`;
        
        const params = {
            fields: 'access_token',
            access_token: userAccessToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            pageAccessToken: response.data.access_token
        };
    } catch (error) {
        console.error("Error getting Facebook page token:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Get user's Facebook pages
 */
const getUserPages = async (accessToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/me/accounts`;
        
        const params = {
            access_token: accessToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            pages: response.data.data
        };
    } catch (error) {
        console.error("Error getting user pages:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Verify WhatsApp Business API access
 */
const verifyWhatsAppAccess = async (phoneNumberId, accessToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/${phoneNumberId}`;
        
        const params = {
            access_token: accessToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            verified: true,
            phoneNumber: response.data.display_phone_number,
            verifiedName: response.data.verified_name
        };
    } catch (error) {
        console.error("Error verifying WhatsApp access:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Send WhatsApp message using Business API
 */
const sendWhatsAppMessage = async (phoneNumberId, accessToken, recipientPhone, message) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/${phoneNumberId}/messages`;
        
        const data = {
            messaging_product: "whatsapp",
            to: recipientPhone,
            type: "text",
            text: {
                body: message
            }
        };

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, data, { headers });
        
        return {
            success: true,
            messageId: response.data.messages[0].id
        };
    } catch (error) {
        console.error("Error sending WhatsApp message:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Get WhatsApp Business Account ID
 */
const getWhatsAppBusinessAccount = async (accessToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/me/businesses`;
        
        const params = {
            access_token: accessToken
        };

        const response = await axios.get(url, { params });
        
        if (response.data.data && response.data.data.length > 0) {
            return {
                success: true,
                businesses: response.data.data
            };
        }
        
        return {
            success: false,
            error: "No WhatsApp Business accounts found"
        };
    } catch (error) {
        console.error("Error getting WhatsApp Business account:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Create Facebook marketing campaign
 */
const createFacebookCampaign = async (accessToken, adAccountId, campaignData) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/act_${adAccountId}/campaigns`;
        
        const data = {
            name: campaignData.name,
            objective: campaignData.objective,
            status: campaignData.status || 'PAUSED',
            special_ad_categories: campaignData.specialAdCategories || []
        };

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, data, { headers });
        
        return {
            success: true,
            campaignId: response.data.id
        };
    } catch (error) {
        console.error("Error creating Facebook campaign:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Get Facebook Ad Accounts
 */
const getAdAccounts = async (accessToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/me/adaccounts`;
        
        const params = {
            fields: 'id,name,account_status,currency,timezone_name',
            access_token: accessToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            adAccounts: response.data.data
        };
    } catch (error) {
        console.error("Error getting ad accounts:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

/**
 * Verify access token
 */
const verifyAccessToken = async (accessToken) => {
    try {
        const url = `${FACEBOOK_GRAPH_URL}/${FACEBOOK_API_VERSION}/me`;
        
        const params = {
            access_token: accessToken
        };

        const response = await axios.get(url, { params });
        
        return {
            success: true,
            userId: response.data.id,
            name: response.data.name
        };
    } catch (error) {
        console.error("Error verifying access token:", error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

module.exports = {
    verifyFacebookCredentials,
    exchangeCodeForToken,
    getLongLivedToken,
    refreshFacebookToken,
    getFacebookPageToken,
    getUserPages,
    verifyWhatsAppAccess,
    sendWhatsAppMessage,
    getWhatsAppBusinessAccount,
    createFacebookCampaign,
    getAdAccounts,
    verifyAccessToken
};