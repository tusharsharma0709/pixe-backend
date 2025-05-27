// services/exotelServices.js - Complete Exotel service implementation

const axios = require('axios');
const FormData = require('form-data');

class ExotelService {
    constructor() {
        this.accountSid = process.env.EXOTEL_ACCOUNT_SID;
        this.apiKey = process.env.EXOTEL_API_KEY;
        this.apiToken = process.env.EXOTEL_API_TOKEN;
        this.subdomain = process.env.EXOTEL_SUBDOMAIN;
        this.baseUrl = `https://${this.subdomain}.exotel.com/v1/Accounts/${this.accountSid}`;
        
        // Validate required environment variables
        if (!this.accountSid || !this.apiKey || !this.apiToken) {
            console.warn('⚠️ Exotel credentials not configured properly');
            console.warn('Required: EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN');
        }
        
        // Create axios instance with auth
        this.axiosInstance = axios.create({
            auth: {
                username: this.apiKey,
                password: this.apiToken
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('✅ Exotel service initialized');
    }

    /**
     * Make an outbound call
     * @param {string} from - Exotel virtual number or caller ID
     * @param {string} to - Destination number
     * @param {string} callerId - Caller ID to display
     * @param {Object} options - Additional call options
     * @returns {Promise<Object>} Call details
     */
    async makeCall(from, to, callerId, options = {}) {
        try {
            console.log(`📞 Making call from ${from} to ${to}`);
            
            const formData = new URLSearchParams();
            formData.append('From', from);
            formData.append('To', to);
            formData.append('CallerId', callerId);
            
            // Optional parameters
            if (options.url) formData.append('Url', options.url);
            if (options.method) formData.append('Method', options.method);
            if (options.fallbackUrl) formData.append('FallbackUrl', options.fallbackUrl);
            if (options.fallbackMethod) formData.append('FallbackMethod', options.fallbackMethod);
            if (options.statusCallback) formData.append('StatusCallback', options.statusCallback);
            if (options.statusCallbackMethod) formData.append('StatusCallbackMethod', options.statusCallbackMethod);
            if (options.statusCallbackEvent) formData.append('StatusCallbackEvent', options.statusCallbackEvent);
            if (options.sendDigits) formData.append('SendDigits', options.sendDigits);
            if (options.timeout) formData.append('Timeout', options.timeout);
            if (options.timeLimit) formData.append('TimeLimit', options.timeLimit);
            if (options.record !== undefined) formData.append('Record', options.record);
            if (options.playBeep !== undefined) formData.append('PlayBeep', options.playBeep);
            if (options.customField1) formData.append('CustomField1', options.customField1);
            if (options.customField2) formData.append('CustomField2', options.customField2);
            
            const response = await this.axiosInstance.post(
                `${this.baseUrl}/Calls/connect.json`,
                formData
            );
            
            console.log('✅ Call initiated successfully:', response.data);
            return {
                success: true,
                data: response.data,
                callSid: response.data.Call?.Sid,
                status: response.data.Call?.Status
            };
            
        } catch (error) {
            console.error('❌ Error making call:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get call details by Call SID
     * @param {string} callSid - Call SID to fetch details
     * @returns {Promise<Object>} Call details
     */
    async getCallDetails(callSid) {
        try {
            console.log(`📋 Fetching call details for: ${callSid}`);
            
            const response = await this.axiosInstance.get(
                `${this.baseUrl}/Calls/${callSid}.json`
            );
            
            console.log('✅ Call details fetched successfully');
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Error fetching call details:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get list of calls with optional filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} List of calls
     */
    async getCalls(filters = {}) {
        try {
            console.log('📋 Fetching calls list with filters:', filters);
            
            const params = new URLSearchParams();
            
            // Add filter parameters
            if (filters.from) params.append('From', filters.from);
            if (filters.to) params.append('To', filters.to);
            if (filters.status) params.append('Status', filters.status);
            if (filters.startTime) params.append('StartTime', filters.startTime);
            if (filters.endTime) params.append('EndTime', filters.endTime);
            if (filters.parentCallSid) params.append('ParentCallSid', filters.parentCallSid);
            if (filters.pageSize) params.append('PageSize', filters.pageSize);
            if (filters.page) params.append('Page', filters.page);
            
            const url = `${this.baseUrl}/Calls.json${params.toString() ? '?' + params.toString() : ''}`;
            
            const response = await this.axiosInstance.get(url);
            
            console.log('✅ Calls list fetched successfully');
            return {
                success: true,
                data: response.data,
                totalCalls: response.data.Calls?.length || 0
            };
            
        } catch (error) {
            console.error('❌ Error fetching calls:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get call recording URL
     * @param {string} callSid - Call SID
     * @param {string} recordingSid - Recording SID (optional)
     * @returns {Promise<Object>} Recording details
     */
    async getCallRecording(callSid, recordingSid = null) {
        try {
            console.log(`🎵 Fetching recording for call: ${callSid}`);
            
            let url;
            if (recordingSid) {
                url = `${this.baseUrl}/Recordings/${recordingSid}.json`;
            } else {
                // Get recordings for a specific call
                url = `${this.baseUrl}/Calls/${callSid}/Recordings.json`;
            }
            
            const response = await this.axiosInstance.get(url);
            
            console.log('✅ Recording details fetched successfully');
            return {
                success: true,
                data: response.data,
                recordings: response.data.Recordings || [response.data.Recording]
            };
            
        } catch (error) {
            console.error('❌ Error fetching recording:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Download call recording
     * @param {string} recordingUrl - Recording URL from getCallRecording
     * @returns {Promise<Object>} Recording file buffer
     */
    async downloadRecording(recordingUrl) {
        try {
            console.log(`⬇️ Downloading recording from: ${recordingUrl}`);
            
            const response = await this.axiosInstance.get(recordingUrl, {
                responseType: 'arraybuffer'
            });
            
            console.log('✅ Recording downloaded successfully');
            return {
                success: true,
                data: Buffer.from(response.data),
                contentType: response.headers['content-type'],
                size: response.data.byteLength
            };
            
        } catch (error) {
            console.error('❌ Error downloading recording:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Hangup an active call
     * @param {string} callSid - Call SID to hangup
     * @returns {Promise<Object>} Hangup result
     */
    async hangupCall(callSid) {
        try {
            console.log(`📴 Hanging up call: ${callSid}`);
            
            const formData = new URLSearchParams();
            formData.append('Status', 'completed');
            
            const response = await this.axiosInstance.post(
                `${this.baseUrl}/Calls/${callSid}.json`,
                formData
            );
            
            console.log('✅ Call hung up successfully');
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Error hanging up call:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Send DTMF digits to an active call
     * @param {string} callSid - Call SID
     * @param {string} digits - DTMF digits to send
     * @returns {Promise<Object>} DTMF result
     */
    async sendDtmf(callSid, digits) {
        try {
            console.log(`🔢 Sending DTMF digits to call ${callSid}: ${digits}`);
            
            const formData = new URLSearchParams();
            formData.append('Digits', digits);
            
            const response = await this.axiosInstance.post(
                `${this.baseUrl}/Calls/${callSid}/SendDigits.json`,
                formData
            );
            
            console.log('✅ DTMF digits sent successfully');
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Error sending DTMF:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get account details and balance
     * @returns {Promise<Object>} Account information
     */
    async getAccountInfo() {
        try {
            console.log('📊 Fetching account information');
            
            const response = await this.axiosInstance.get(
                `${this.baseUrl}.json`
            );
            
            console.log('✅ Account information fetched successfully');
            return {
                success: true,
                data: response.data,
                balance: response.data.Account?.AccountBalance,
                status: response.data.Account?.Status
            };
            
        } catch (error) {
            console.error('❌ Error fetching account info:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Create a phone number (buy a number)
     * @param {string} phoneNumber - Phone number to purchase
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Phone number creation result
     */
    async createPhoneNumber(phoneNumber, options = {}) {
        try {
            console.log(`📱 Creating phone number: ${phoneNumber}`);
            
            const formData = new URLSearchParams();
            formData.append('PhoneNumber', phoneNumber);
            
            if (options.friendlyName) formData.append('FriendlyName', options.friendlyName);
            if (options.voiceUrl) formData.append('VoiceUrl', options.voiceUrl);
            if (options.voiceMethod) formData.append('VoiceMethod', options.voiceMethod);
            if (options.voiceFallbackUrl) formData.append('VoiceFallbackUrl', options.voiceFallbackUrl);
            if (options.voiceFallbackMethod) formData.append('VoiceFallbackMethod', options.voiceFallbackMethod);
            if (options.smsUrl) formData.append('SmsUrl', options.smsUrl);
            if (options.smsMethod) formData.append('SmsMethod', options.smsMethod);
            if (options.smsFallbackUrl) formData.append('SmsFallbackUrl', options.smsFallbackUrl);
            if (options.smsFallbackMethod) formData.append('SmsFallbackMethod', options.smsFallbackMethod);
            
            const response = await this.axiosInstance.post(
                `${this.baseUrl}/IncomingPhoneNumbers.json`,
                formData
            );
            
            console.log('✅ Phone number created successfully');
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('❌ Error creating phone number:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get list of phone numbers
     * @returns {Promise<Object>} List of phone numbers
     */
    async getPhoneNumbers() {
        try {
            console.log('📱 Fetching phone numbers');
            
            const response = await this.axiosInstance.get(
                `${this.baseUrl}/IncomingPhoneNumbers.json`
            );
            
            console.log('✅ Phone numbers fetched successfully');
            return {
                success: true,
                data: response.data,
                phoneNumbers: response.data.IncomingPhoneNumbers || []
            };
            
        } catch (error) {
            console.error('❌ Error fetching phone numbers:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Validate configuration
     * @returns {boolean} True if properly configured
     */
    isConfigured() {
        return !!(this.accountSid && this.apiKey && this.apiToken);
    }

    /**
     * Format phone number for Exotel (add country code if needed)
     * @param {string} phoneNumber - Phone number to format
     * @param {string} countryCode - Country code (default: +91 for India)
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phoneNumber, countryCode = '+91') {
        // Remove any non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // If already has country code, return as is
        if (cleaned.length > 10) {
            return '+' + cleaned;
        }
        
        // Add country code
        return countryCode + cleaned;
    }

    /**
     * Generate callback URLs for webhooks
     * @param {string} baseUrl - Your server base URL
     * @returns {Object} Callback URLs
     */
    generateCallbackUrls(baseUrl) {
        return {
            statusCallback: `${baseUrl}/api/exotel/webhook/call-status`,
            voiceUrl: `${baseUrl}/api/exotel/webhook/voice`,
            fallbackUrl: `${baseUrl}/api/exotel/webhook/fallback`,
            recordingCallback: `${baseUrl}/api/exotel/webhook/recording`
        };
    }
}

module.exports = new ExotelService();