// services/makeServices.js - Fixed with proper authentication & debugging

const axios = require('axios');

// Configuration
const MAKE_CONFIG = {
    apiToken: process.env.MAKE_API_TOKEN,
    baseUrl: process.env.MAKE_API_URL || 'https://us2.make.com/api/v2',
    timeout: 30000,
    retries: 3
};

// Validate configuration
if (!MAKE_CONFIG.apiToken) {
    console.error('❌ MAKE_API_TOKEN not configured! Set it in your .env file');
    console.log('📋 How to get your Make.com API token:');
    console.log('   1. Go to Make.com → Profile → API tab');
    console.log('   2. Click "Add token"');
    console.log('   3. Select scopes: scenarios:read, scenarios:run, hooks:read');
    console.log('   4. Copy the token to your .env file');
}

// Create axios instance with proper authentication
const apiClient = axios.create({
    baseURL: MAKE_CONFIG.baseUrl,
    timeout: MAKE_CONFIG.timeout,
    headers: {
        'Authorization': `Token ${MAKE_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
});

// Enhanced request interceptor with debugging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`🔄 Make.com API Request:`);
        console.log(`   Method: ${config.method.toUpperCase()}`);
        console.log(`   URL: ${config.baseURL}${config.url}`);
        console.log(`   Auth: ${config.headers.Authorization ? 'Present' : 'Missing'}`);
        console.log(`   Token starts with: ${MAKE_CONFIG.apiToken?.substring(0, 10)}...`);
        return config;
    },
    (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// Enhanced response interceptor
apiClient.interceptors.response.use(
    (response) => {
        console.log(`✅ Make.com API Response: ${response.status} - Success!`);
        if (response.data) {
            const dataCount = response.data?.data?.length || response.data?.length || 'unknown';
            console.log(`   Data items: ${dataCount}`);
        }
        return response;
    },
    (error) => {
        console.error(`❌ Make.com API Error:`);
        console.error(`   Status: ${error.response?.status}`);
        console.error(`   Message: ${error.response?.data?.message || error.response?.data?.detail || error.message}`);
        console.error(`   Code: ${error.response?.data?.code || 'N/A'}`);
        console.error(`   URL: ${error.config?.url}`);
        
        // Special handling for common errors
        if (error.response?.status === 401) {
            console.error(`🔐 AUTHENTICATION FAILED - Common Causes:`);
            console.error(`   1. Invalid API token`);
            console.error(`   2. Missing required scopes (scenarios:read, etc.)`);
            console.error(`   3. Token expired`);
            console.error(`   4. Wrong region (eu1 vs us1)`);
        } else if (error.response?.status === 403) {
            console.error(`🚫 PERMISSION DENIED - Your token lacks required scopes`);
        } else if (error.response?.status === 404) {
            console.error(`🔍 NOT FOUND - Check if the resource exists`);
        }
        
        return Promise.reject(error);
    }
);

// Error handling helper
const handleApiError = (error, operation) => {
    const errorInfo = {
        operation,
        status: error.response?.status || 500,
        message: error.response?.data?.message || error.response?.data?.detail || error.message || 'Unknown error',
        code: error.response?.data?.code || 'UNKNOWN_ERROR',
        details: error.response?.data || null,
        timestamp: new Date().toISOString(),
        // Debug info
        url: error.config?.url,
        method: error.config?.method,
        hasAuth: !!error.config?.headers?.Authorization
    };
    
    console.error(`❌ Make.com ${operation} failed:`, errorInfo);
    
    // Add helpful suggestions based on error type
    if (errorInfo.status === 401) {
        errorInfo.suggestions = [
            'Regenerate your API token in Make.com',
            'Ensure token has required scopes: scenarios:read, scenarios:run',
            'Check if token is copied correctly (no extra spaces)',
            'Verify you\'re using the correct region (eu1/us1)'
        ];
    }
    
    throw errorInfo;
};

/**
 * CORE API FUNCTIONS
 */

// Get all scenarios
const getScenarios = async (limit = 100) => {
    try {
        console.log(`📋 Fetching Make.com scenarios (limit: ${limit})...`);
        
        if (!MAKE_CONFIG.apiToken) {
            throw new Error('API token not configured. Please set MAKE_API_TOKEN in your .env file.');
        }
        
        // Use the correct endpoint according to Make.com API docs
        const response = await apiClient.get('/scenarios', {
            params: { limit }
        });
        
        // Handle different response formats
        const scenarios = response.data?.data || response.data || [];
        
        console.log(`✅ Successfully fetched ${scenarios.length} scenarios`);
        
        // Log first few scenarios for verification
        if (scenarios.length > 0) {
            console.log(`📋 Sample scenarios:`);
            scenarios.slice(0, 3).forEach((scenario, index) => {
                console.log(`   ${index + 1}. ${scenario.name || 'Unnamed'} (ID: ${scenario.id})`);
            });
        }
        
        return {
            success: true,
            data: scenarios,
            total: scenarios.length,
            limit: limit
        };
        
    } catch (error) {
        handleApiError(error, 'getScenarios');
    }
};

// Get single scenario by ID
const getScenario = async (scenarioId) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        console.log(`📋 Fetching scenario: ${scenarioId}`);
        
        const response = await apiClient.get(`/scenarios/${scenarioId}`);
        const scenario = response.data?.data || response.data;
        
        console.log(`✅ Found scenario: ${scenario?.name || 'Unnamed'}`);
        
        return {
            success: true,
            data: scenario
        };
    } catch (error) {
        handleApiError(error, 'getScenario');
    }
};

// Run/trigger a scenario
const runMakeScenario = async (scenarioId, inputData = {}) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        console.log(`🚀 Triggering Make.com scenario: ${scenarioId}`);
        console.log(`📦 Input data:`, Object.keys(inputData).length > 0 ? Object.keys(inputData) : 'None');
        
        const response = await apiClient.post(`/scenarios/${scenarioId}/run`, inputData);
        
        console.log(`✅ Scenario triggered successfully!`);
        
        return {
            success: true,
            data: response.data?.data || response.data,
            scenarioId,
            triggeredAt: new Date().toISOString()
        };
        
    } catch (error) {
        handleApiError(error, 'runMakeScenario');
    }
};

// Get all webhooks
const getWebhooks = async (limit = 100) => {
    try {
        console.log(`📋 Fetching Make.com webhooks (limit: ${limit})...`);
        
        const response = await apiClient.get('/hooks', {
            params: { limit }
        });
        
        const webhooks = response.data?.data || response.data || [];
        
        console.log(`✅ Successfully fetched ${webhooks.length} webhooks`);
        
        return {
            success: true,
            data: webhooks,
            total: webhooks.length
        };
    } catch (error) {
        handleApiError(error, 'getWebhooks');
    }
};

// Get single webhook
const getWebhook = async (webhookId) => {
    try {
        if (!webhookId) {
            throw new Error('Webhook ID is required');
        }
        
        console.log(`📋 Fetching webhook: ${webhookId}`);
        
        const response = await apiClient.get(`/hooks/${webhookId}`);
        const webhook = response.data?.data || response.data;
        
        return {
            success: true,
            data: webhook
        };
    } catch (error) {
        handleApiError(error, 'getWebhook');
    }
};

/**
 * UTILITY & DEBUGGING FUNCTIONS
 */

// Test connection with detailed diagnostics
const testConnection = async () => {
    try {
        console.log(`🔍 Testing Make.com connection...`);
        console.log(`📍 Region: ${MAKE_CONFIG.baseUrl.includes('eu1') ? 'EU' : 'US'}`);
        console.log(`🔗 Base URL: ${MAKE_CONFIG.baseUrl}`);
        console.log(`🔑 Token configured: ${!!MAKE_CONFIG.apiToken}`);
        
        if (!MAKE_CONFIG.apiToken) {
            throw new Error('API token not configured. Please set MAKE_API_TOKEN environment variable.');
        }
        
        // Test with a simple scenarios request
        const result = await getScenarios(1);
        
        return {
            success: true,
            message: 'Make.com connection successful',
            details: {
                region: MAKE_CONFIG.baseUrl.includes('eu1') ? 'EU' : 'US',
                baseUrl: MAKE_CONFIG.baseUrl,
                scenariosFound: result.total,
                tokenConfigured: true,
                tokenPrefix: MAKE_CONFIG.apiToken.substring(0, 10)
            }
        };
        
    } catch (error) {
        console.error(`❌ Connection test failed:`, error.message);
        
        return {
            success: false,
            message: 'Make.com connection failed',
            error: error.message,
            details: {
                region: MAKE_CONFIG.baseUrl.includes('eu1') ? 'EU' : 'US',
                baseUrl: MAKE_CONFIG.baseUrl,
                tokenConfigured: !!MAKE_CONFIG.apiToken,
                errorCode: error.code || error.status
            },
            troubleshooting: [
                '1. Go to Make.com → Profile → API',
                '2. Create new API token with these scopes:',
                '   - scenarios:read (to list scenarios)',
                '   - scenarios:run (to trigger scenarios)', 
                '   - hooks:read (to list webhooks)',
                '3. Copy token to MAKE_API_TOKEN in .env',
                '4. Restart your application',
                '5. Verify correct region (eu1 vs us1)'
            ]
        };
    }
};

// Test different authentication formats
const testAuthentication = async () => {
    console.log(`🔍 Testing different authentication methods...`);
    
    const authMethods = [
        { name: 'Token Format', header: `Token ${MAKE_CONFIG.apiToken}` },
        { name: 'Bearer Format', header: `Bearer ${MAKE_CONFIG.apiToken}` }
    ];

    const results = [];

    for (const method of authMethods) {
        try {
            console.log(`   Testing: ${method.name}`);
            
            const testClient = axios.create({
                baseURL: MAKE_CONFIG.baseUrl,
                timeout: 10000,
                headers: {
                    'Authorization': method.header,
                    'Content-Type': 'application/json'
                }
            });

            const response = await testClient.get('/scenarios', { params: { limit: 1 } });
            
            results.push({
                method: method.name,
                success: true,
                status: response.status,
                itemsFound: response.data?.data?.length || 0
            });
            
            console.log(`   ✅ ${method.name} works!`);
            
        } catch (error) {
            results.push({
                method: method.name,
                success: false,
                status: error.response?.status,
                error: error.response?.data?.message || error.message
            });
            
            console.log(`   ❌ ${method.name} failed: ${error.response?.status}`);
        }
    }
    
    const workingMethod = results.find(r => r.success);
    
    return {
        success: !!workingMethod,
        results: results,
        workingMethod: workingMethod?.method || null,
        recommendation: workingMethod ? 
            `Use ${workingMethod.method} for authentication` : 
            'No authentication method worked - check your API token and scopes'
    };
};

// Get comprehensive service status
const getServiceStatus = async () => {
    try {
        const connectionTest = await testConnection();
        
        let scenarios = { total: 0 };
        let webhooks = { total: 0 };
        
        if (connectionTest.success) {
            try {
                scenarios = await getScenarios(10);
                webhooks = await getWebhooks(10);
            } catch (error) {
                console.log('⚠️ Could not fetch detailed counts:', error.message);
            }
        }
        
        return {
            success: connectionTest.success,
            status: {
                connected: connectionTest.success,
                region: connectionTest.details?.region || 'Unknown',
                scenarios: scenarios.total,
                webhooks: webhooks.total,
                lastChecked: new Date().toISOString()
            },
            config: connectionTest.details,
            error: connectionTest.success ? null : connectionTest.error,
            troubleshooting: connectionTest.success ? null : connectionTest.troubleshooting
        };
        
    } catch (error) {
        return {
            success: false,
            status: {
                connected: false,
                error: error.message,
                lastChecked: new Date().toISOString()
            }
        };
    }
};

module.exports = {
    // Core scenario functions
    getScenarios,
    getScenario,
    runMakeScenario,
    
    // Webhook functions
    getWebhooks,
    getWebhook,
    
    // Testing & debugging functions
    testConnection,
    testAuthentication,
    getServiceStatus,
    
    // Configuration
    config: MAKE_CONFIG
};