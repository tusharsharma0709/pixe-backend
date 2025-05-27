// services/makeServices.js - Enhanced Make.com integration service

const axios = require('axios');

// Configuration
const MAKE_CONFIG = {
    apiToken: process.env.MAKE_API_TOKEN,
    baseUrl: process.env.MAKE_API_URL || 'https://eu1.make.com/api/v2',
    timeout: 30000, // 30 seconds
    retries: 3
};

// Validate configuration
if (!MAKE_CONFIG.apiToken) {
    console.warn('⚠️ MAKE_API_TOKEN not configured - Make.com integration will not work');
}

// Axios instance with enhanced configuration
const apiClient = axios.create({
    baseURL: MAKE_CONFIG.baseUrl,
    timeout: MAKE_CONFIG.timeout,
    headers: {
        'Authorization': `Token ${MAKE_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`🔄 Make.com API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('❌ Make.com API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for logging and error handling
apiClient.interceptors.response.use(
    (response) => {
        console.log(`✅ Make.com API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error(`❌ Make.com API Error: ${error.response?.status} ${error.config?.url}`, 
            error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// Helper function to handle API errors consistently
const handleApiError = (error, operation) => {
    const errorInfo = {
        operation,
        status: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Unknown error',
        details: error.response?.data || null,
        timestamp: new Date().toISOString()
    };
    
    console.error(`❌ Make.com ${operation} failed:`, errorInfo);
    throw errorInfo;
};

// Retry mechanism for critical operations
const withRetry = async (operation, maxRetries = MAKE_CONFIG.retries) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries && error.response?.status >= 500) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ Retrying Make.com operation in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            break;
        }
    }
    
    throw lastError;
};

/**
 * SCENARIO MANAGEMENT
 */

// Get all scenarios
const getScenarios = async () => {
    try {
        return await withRetry(async () => {
            const response = await apiClient.get('/scenarios');
            return {
                success: true,
                data: response.data,
                total: response.data?.length || 0
            };
        });
    } catch (error) {
        handleApiError(error, 'getScenarios');
    }
};

// Get single scenario
const getScenario = async (scenarioId) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        const response = await apiClient.get(`/scenarios/${scenarioId}`);
        return {
            success: true,
            data: response.data
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
        
        console.log(`🚀 Triggering Make scenario ${scenarioId} with data:`, inputData);
        
        return await withRetry(async () => {
            const response = await apiClient.post(`/scenarios/${scenarioId}/run`, inputData);
            return {
                success: true,
                data: response.data,
                scenarioId,
                triggeredAt: new Date().toISOString()
            };
        });
    } catch (error) {
        handleApiError(error, 'runMakeScenario');
    }
};

// Create a new scenario
const createScenario = async (scenarioData) => {
    try {
        if (!scenarioData || !scenarioData.name) {
            throw new Error('Scenario name is required');
        }
        
        const response = await apiClient.post('/scenarios', scenarioData);
        return {
            success: true,
            data: response.data,
            message: 'Scenario created successfully'
        };
    } catch (error) {
        handleApiError(error, 'createScenario');
    }
};

// Update existing scenario
const updateScenario = async (scenarioId, scenarioData) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        const response = await apiClient.put(`/scenarios/${scenarioId}`, scenarioData);
        return {
            success: true,
            data: response.data,
            message: 'Scenario updated successfully'
        };
    } catch (error) {
        handleApiError(error, 'updateScenario');
    }
};

// Delete scenario
const deleteScenario = async (scenarioId) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        await apiClient.delete(`/scenarios/${scenarioId}`);
        return {
            success: true,
            message: 'Scenario deleted successfully',
            scenarioId
        };
    } catch (error) {
        handleApiError(error, 'deleteScenario');
    }
};

// Get scenario execution history
const getScenarioExecutions = async (scenarioId, limit = 10) => {
    try {
        if (!scenarioId) {
            throw new Error('Scenario ID is required');
        }
        
        const response = await apiClient.get(`/scenarios/${scenarioId}/executions`, {
            params: { limit }
        });
        
        return {
            success: true,
            data: response.data,
            scenarioId,
            limit
        };
    } catch (error) {
        handleApiError(error, 'getScenarioExecutions');
    }
};

/**
 * WEBHOOK MANAGEMENT
 */

// Get all webhooks
const getWebhooks = async () => {
    try {
        const response = await apiClient.get('/hooks');
        return {
            success: true,
            data: response.data,
            total: response.data?.length || 0
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
        
        const response = await apiClient.get(`/hooks/${webhookId}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        handleApiError(error, 'getWebhook');
    }
};

// Create webhook
const createWebhook = async (webhookData) => {
    try {
        if (!webhookData || !webhookData.name) {
            throw new Error('Webhook name is required');
        }
        
        const response = await apiClient.post('/hooks', webhookData);
        return {
            success: true,
            data: response.data,
            message: 'Webhook created successfully'
        };
    } catch (error) {
        handleApiError(error, 'createWebhook');
    }
};

// Update webhook
const updateWebhook = async (webhookId, webhookData) => {
    try {
        if (!webhookId) {
            throw new Error('Webhook ID is required');
        }
        
        const response = await apiClient.put(`/hooks/${webhookId}`, webhookData);
        return {
            success: true,
            data: response.data,
            message: 'Webhook updated successfully'
        };
    } catch (error) {
        handleApiError(error, 'updateWebhook');
    }
};

// Delete webhook
const deleteWebhook = async (webhookId) => {
    try {
        if (!webhookId) {
            throw new Error('Webhook ID is required');
        }
        
        await apiClient.delete(`/hooks/${webhookId}`);
        return {
            success: true,
            message: 'Webhook deleted successfully',
            webhookId
        };
    } catch (error) {
        handleApiError(error, 'deleteWebhook');
    }
};

/**
 * WEBHOOK QUEUE MANAGEMENT
 */

// Get webhook queue (for pull webhooks)
const getWebhookQueue = async (hookId, limit = 100) => {
    try {
        if (!hookId) {
            throw new Error('Hook ID is required');
        }
        
        const response = await apiClient.get(`/hooks/${hookId}/incomings`, {
            params: { limit }
        });
        
        return {
            success: true,
            data: response.data,
            hookId,
            count: response.data?.length || 0
        };
    } catch (error) {
        handleApiError(error, 'getWebhookQueue');
    }
};

// Delete webhook queue items
const deleteWebhookQueueItems = async (hookId, options = {}) => {
    try {
        if (!hookId) {
            throw new Error('Hook ID is required');
        }
        
        const { ids = [], deleteAll = false } = options;
        
        if (!deleteAll && (!ids || ids.length === 0)) {
            throw new Error('Either provide item IDs or set deleteAll to true');
        }
        
        const payload = deleteAll ? { all: true } : { ids };
        const params = deleteAll ? { confirmed: true } : {};
        
        const response = await apiClient.delete(`/hooks/${hookId}/incomings`, {
            data: payload,
            params
        });
        
        return {
            success: true,
            data: response.data,
            message: deleteAll ? 'All queue items deleted' : `${ids.length} queue items deleted`,
            hookId
        };
    } catch (error) {
        handleApiError(error, 'deleteWebhookQueueItems');
    }
};

// Get webhook logs
const getWebhookLogs = async (hookId, limit = 50) => {
    try {
        if (!hookId) {
            throw new Error('Hook ID is required');
        }
        
        const response = await apiClient.get(`/hooks/${hookId}/logs`, {
            params: { limit }
        });
        
        return {
            success: true,
            data: response.data,
            hookId,
            limit
        };
    } catch (error) {
        handleApiError(error, 'getWebhookLogs');
    }
};

/**
 * UTILITY FUNCTIONS
 */

// Test Make.com connection
const testConnection = async () => {
    try {
        if (!MAKE_CONFIG.apiToken) {
            throw new Error('Make.com API token not configured');
        }
        
        // Try to fetch scenarios to test connection
        await apiClient.get('/scenarios', { params: { limit: 1 } });
        
        return {
            success: true,
            message: 'Make.com connection successful',
            config: {
                baseUrl: MAKE_CONFIG.baseUrl,
                hasToken: !!MAKE_CONFIG.apiToken,
                timeout: MAKE_CONFIG.timeout
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Make.com connection failed',
            error: error.message || 'Unknown error'
        };
    }
};

// Get Make.com service status
const getServiceStatus = async () => {
    try {
        const connection = await testConnection();
        const scenarios = await getScenarios();
        const webhooks = await getWebhooks();
        
        return {
            success: true,
            status: {
                connected: connection.success,
                totalScenarios: scenarios.total,
                totalWebhooks: webhooks.total,
                lastChecked: new Date().toISOString()
            }
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
    // Scenario management
    getScenarios,
    getScenario,
    runMakeScenario,
    createScenario,
    updateScenario,
    deleteScenario,
    getScenarioExecutions,
    
    // Webhook management
    getWebhooks,
    getWebhook,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    
    // Webhook queue management
    getWebhookQueue,
    deleteWebhookQueueItems,
    getWebhookLogs,
    
    // Utility functions
    testConnection,
    getServiceStatus,
    
    // Export config for debugging
    config: MAKE_CONFIG
};