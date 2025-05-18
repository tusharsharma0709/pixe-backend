// services/workflowExecutor.js - Updated for Direct Aadhaar and PAN Verification

const { Message } = require('../models/Messages');
const { Workflow } = require('../models/Workflows');
const { UserSession } = require('../models/UserSessions');
const { User } = require('../models/Users');
const { Verification } = require('../models/Verifications');
const whatsappService = require('./whatsappServices');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Store recently processed message IDs to prevent duplicate processing
const recentProcessedMessages = new Map();

// Track node execution counts to prevent infinite loops
const nodeExecutionCounts = new Map();

// Helper functions defined first
function incrementNodeExecutionCount(key) {
    const count = nodeExecutionCounts.get(key) || 0;
    nodeExecutionCounts.set(key, count + 1);
    
    // Auto cleanup - remove counts older than 1 hour
    setTimeout(() => {
        nodeExecutionCounts.delete(key);
    }, 3600000);
    
    return count + 1;
}

function resetNodeExecutionCount(sessionId, nodeId) {
    const key = `${sessionId}:${nodeId}`;
    nodeExecutionCounts.delete(key);
}

function evaluateCondition(condition, data) {
    try {
        if (!condition) return false;
        
        // Safety check for data
        if (!data) {
            console.error('❌ No data provided for condition evaluation');
            return false;
        }
        
        // Debug condition evaluation
        console.log(`  Evaluating: "${condition}" with data:`, data);
        
        // Check for length conditions like string.length == 12
        const lengthRegex = /(\w+)\.replace\([^)]+\)\.length\s*(==|!=|>|<|>=|<=)\s*(\d+)/;
        const lengthMatch = condition.match(lengthRegex);
        
        if (lengthMatch) {
            const [, fieldName, operator, expectedLength] = lengthMatch;
            let fieldValue = data[fieldName];
            
            if (fieldValue === undefined || fieldValue === null) {
                return false;
            }
            
            // If field exists, apply the replace operation mentioned in the condition
            // This is a simplified implementation - in real code you'd use a safer approach
            fieldValue = String(fieldValue).replace(/\s+/g, '');  // Assuming replace(/\s+/g, '')
            const actualLength = fieldValue.length;
            const expectedLengthNum = parseInt(expectedLength);
            
            // Compare lengths based on operator
            switch (operator) {
                case '==': return actualLength === expectedLengthNum;
                case '!=': return actualLength !== expectedLengthNum;
                case '>': return actualLength > expectedLengthNum;
                case '<': return actualLength < expectedLengthNum;
                case '>=': return actualLength >= expectedLengthNum;
                case '<=': return actualLength <= expectedLengthNum;
                default: return false;
            }
        }
        
        // Check for boolean values directly
        if (condition === 'true') return true;
        if (condition === 'false') return false;
        
        // Check if we're testing a direct boolean property
        if (data[condition] !== undefined) {
            return Boolean(data[condition]);
        }
        
        // Check for direct comparison operators
        const compareRegex = /(\w+)\s*(>|<|>=|<=|==|!=)\s*([\w"']+)/;
        const compareMatch = condition.match(compareRegex);
        
        if (compareMatch) {
            const [, field, operator, valueStr] = compareMatch;
            const fieldValue = data[field];
            
            // Handle different value types
            let value;
            if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
                // It's a string, remove quotes
                value = valueStr.substring(1, valueStr.length - 1);
            } else if (valueStr === 'true') {
                value = true;
            } else if (valueStr === 'false') {
                value = false;
            } else if (!isNaN(Number(valueStr))) {
                value = Number(valueStr);
            } else {
                // It might be another field reference
                value = data[valueStr];
            }
            
            // Debug comparison
            console.log(`  Comparing: ${field} (${fieldValue}) ${operator} ${value}`);
            
            switch (operator) {
                case '>': return fieldValue > value;
                case '<': return fieldValue < value;
                case '>=': return fieldValue >= value;
                case '<=': return fieldValue <= value;
                case '==': return fieldValue == value; // Use loose equality
                case '!=': return fieldValue != value; // Use loose inequality
                default: return false;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
    }
}

function generateSessionToken(session) {
    try {
        return jwt.sign(
            { 
                userId: session.userId,
                sessionId: session._id,
                workflowId: session.workflowId
            },
            process.env.JWT_SECRET || 'workflow_jwt_secret',
            { expiresIn: '1h' }
        );
    } catch (error) {
        console.error('Error generating session token:', error);
        return '';
    }
}

/**
 * Process user input for a workflow
 * @param {Object} session - The user session
 * @param {String} input - The user input message
 * @param {String} messageId - Optional WhatsApp message ID for deduplication
 */
async function processWorkflowInput(session, input, messageId = null) {
    try {
        // Check for duplicate message processing if messageId is provided
        if (messageId) {
            const key = `${session._id}:${messageId}`;
            if (recentProcessedMessages.has(key)) {
                console.log(`⚠️ Skipping duplicate message processing: ${messageId}`);
                return;
            }
            
            // Add to processed messages
            recentProcessedMessages.set(key, Date.now());
            
            // Cleanup old entries (keep for 1 hour)
            const now = Date.now();
            for (const [key, timestamp] of recentProcessedMessages.entries()) {
                if (now - timestamp > 3600000) { // 1 hour
                    recentProcessedMessages.delete(key);
                }
            }
        }
        
        console.log(`⚙️ Processing workflow input for session ${session._id}`);
        console.log(`  Input: "${input}"`);
        console.log(`  Current node: ${session.currentNodeId}`);
        
        // Get workflow
        const workflow = await Workflow.findById(session.workflowId);
        if (!workflow) {
            console.error(`❌ Workflow ${session.workflowId} not found`);
            return;
        }
        
        // Find current node
        const currentNode = workflow.nodes.find(n => n.nodeId === session.currentNodeId);
        if (!currentNode) {
            console.error(`❌ Current node ${session.currentNodeId} not found in workflow`);
            return;
        }
        
        console.log(`  Node type: ${currentNode.type}`);
        console.log(`  Node name: ${currentNode.name}`);
        
        if (currentNode.type === 'input') {
            // Store user input in session data
            const variableName = currentNode.variableName;
            if (!variableName) {
                console.error('❌ No variable name defined for input node');
                return;
            }
            
            // Initialize data object if needed
            if (!session.data) {
                session.data = {};
            }
            
            // Save the user's input to the session data
            session.data[variableName] = input;
            session.markModified('data');
            console.log(`✅ Stored input in '${variableName}': "${input}"`);
            
            // If this node has a next node, execute it
            if (currentNode.nextNodeId) {
                console.log(`⏭️ Moving to next node: ${currentNode.nextNodeId}`);
                
                // First save the session with the input
                await session.save();
                
                // Reset the execution count for the next node to prevent false positives
                resetNodeExecutionCount(session._id, currentNode.nextNodeId);
                
                // Add a small delay to prevent race conditions
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Then execute the next node
                await executeWorkflowNode(session, currentNode.nextNodeId);
            } else {
                console.error(`❌ No next node defined for input node ${currentNode.nodeId}`);
                // Just save the session
                await session.save();
            }
        } else {
            console.log(`⚠️ Current node is not an input node. Type: ${currentNode.type}`);
            // Just save the session
            await session.save();
        }
    } catch (error) {
        console.error(`❌ Error processing workflow input:`, error);
        // Try to save the session despite error
        try {
            await session.save();
        } catch (saveError) {
            console.error('❌ Error saving session:', saveError);
        }
    }
}

/**
 * Execute a workflow node
 * @param {Object} session - The user session
 * @param {String} nodeId - The node ID to execute
 */
async function executeWorkflowNode(session, nodeId) {
    try {
        console.log(`\n🔄 Executing workflow node for session ${session._id}`);
        console.log(`  Node ID: ${nodeId}`);
        
        // Check for excessive node executions (loop prevention)
        const sessionNodeKey = `${session._id}:${nodeId}`;
        const executionCount = incrementNodeExecutionCount(sessionNodeKey);
        
        // If a node has been executed too many times (potential loop), stop execution
        const MAX_NODE_EXECUTIONS = 5;
        if (executionCount > MAX_NODE_EXECUTIONS) {
            console.error(`⛔ Detected potential infinite loop: node ${nodeId} executed ${executionCount} times`);
            console.error(`⛔ Stopping workflow execution to prevent spamming the user`);
            return false;
        }
        
        // Get workflow
        const workflow = await Workflow.findById(session.workflowId);
        if (!workflow) {
            console.error(`❌ Workflow ${session.workflowId} not found`);
            return false;
        }
        
        // Find node
        const node = workflow.nodes.find(n => n.nodeId === nodeId);
        if (!node) {
            console.error(`❌ Node ${nodeId} not found in workflow ${workflow._id}`);
            return false;
        }
        
        console.log(`  Node name: ${node.name}`);
        console.log(`  Node type: ${node.type}`);
        
        // Update session with current node
        session.previousNodeId = session.currentNodeId;
        session.currentNodeId = nodeId;
        await session.save();
        console.log(`✅ Updated session current node to: ${nodeId}`);
        
        // Execute node based on type
        switch (node.type) {
            case 'message':
                // Replace variables in content
                let content = node.content;
                if (content && session.data) {
                    for (const [key, value] of Object.entries(session.data)) {
                        if (value !== undefined && value !== null) {
                            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                            content = content.replace(regex, value);
                        }
                    }
                }
                
                console.log(`  Sending message: "${content}"`);
                
                try {
                    // Send WhatsApp message
                    const messageResult = await whatsappService.sendMessage(session.phone, content);
                    console.log('✅ WhatsApp API response:', JSON.stringify(messageResult));
                    
                    // Get message ID from WhatsApp response
                    const whatsappMessageId = messageResult.messages?.[0]?.id;
                    
                    // Create message record
                    await Message.create({
                        sessionId: session._id,
                        userId: session.userId,
                        adminId: session.adminId,
                        campaignId: session.campaignId,
                        sender: 'workflow',
                        messageType: 'text',
                        content: content,
                        status: 'sent',
                        nodeId: node.nodeId,
                        whatsappMessageId
                    });
                    
                    console.log('✅ Saved message to database');
                    
                    // Wait to avoid rate limits (also helps prevent message flood)
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Move to next node if defined
                    if (node.nextNodeId) {
                        const nextNode = workflow.nodes.find(n => n.nodeId === node.nextNodeId);
                        
                        // Reset the execution count for the next node to prevent false positives
                        resetNodeExecutionCount(session._id, node.nextNodeId);
                        
                        // If next node is input, just update session and wait
                        if (nextNode && nextNode.type === 'input') {
                            console.log(`⏸️ Next node is input type. Waiting for user response...`);
                            
                            // If input node has prompt content, send it now
                            if (nextNode.content) {
                                console.log(`📤 Sending input prompt message`);
                                await executeWorkflowNode(session, node.nextNodeId);
                            } else {
                                // Just update session current node
                                session.currentNodeId = node.nextNodeId;
                                await session.save();
                            }
                        } else if (nextNode) {
                            // For other node types, continue executing workflow
                            console.log(`⏭️ Moving to next node: ${node.nextNodeId}`);
                            await executeWorkflowNode(session, node.nextNodeId);
                        }
                    } else {
                        console.log(`⚠️ No next node defined for message node ${node.nodeId}`);
                    }
                } catch (error) {
                    console.error(`❌ Error sending message:`, error);
                    return false;
                }
                break;
                
            case 'input':
                // For input nodes, send prompt if exists, then wait for user input
                if (node.content) {
                    // Replace variables in prompt content
                    let promptContent = node.content;
                    if (promptContent && session.data) {
                        for (const [key, value] of Object.entries(session.data)) {
                            if (value !== undefined && value !== null) {
                                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                                promptContent = promptContent.replace(regex, value);
                            }
                        }
                    }
                    
                    console.log(`  Sending input prompt: "${promptContent}"`);
                    
                    try {
                        // Send WhatsApp message for the prompt
                        const promptResult = await whatsappService.sendMessage(session.phone, promptContent);
                        
                        // Get message ID
                        const whatsappMessageId = promptResult.messages?.[0]?.id;
                        
                        // Create message record for the prompt
                        await Message.create({
                            sessionId: session._id,
                            userId: session.userId,
                            adminId: session.adminId,
                            campaignId: session.campaignId,
                            sender: 'workflow',
                            messageType: 'text',
                            content: promptContent,
                            status: 'sent',
                            nodeId: node.nodeId,
                            whatsappMessageId
                        });
                        
                        console.log('✅ Saved prompt message to database');
                    } catch (error) {
                        console.error(`❌ Error sending input prompt:`, error);
                        return false;
                    }
                }
                
                console.log(`⏸️ Input node - waiting for variable: ${node.variableName}`);
                break;
                
            case 'condition':
                console.log(`  Evaluating condition: ${node.condition}`);
                
                // Check for retry count on this condition node
                if (node.maxRetries) {
                    // Initialize retry count in session data if needed
                    if (!session.data) session.data = {};
                    if (!session.data.retryCount) session.data.retryCount = {};
                    if (!session.data.retryCount[node.nodeId]) session.data.retryCount[node.nodeId] = 0;
                    
                    // Increment retry count
                    session.data.retryCount[node.nodeId]++;
                    session.markModified('data');
                    
                    console.log(`  Retry count for node ${node.nodeId}: ${session.data.retryCount[node.nodeId]}/${node.maxRetries}`);
                    
                    // Check if max retries reached
                    if (session.data.retryCount[node.nodeId] > node.maxRetries) {
                        console.log(`⚠️ Max retries (${node.maxRetries}) reached for condition node ${node.nodeId}`);
                        
                        // Go to a designated failure node or end the workflow
                        if (node.maxRetriesNodeId) {
                            console.log(`⏭️ Moving to max retries node: ${node.maxRetriesNodeId}`);
                            
                            // Reset the execution count for the next node
                            resetNodeExecutionCount(session._id, node.maxRetriesNodeId);
                            
                            return executeWorkflowNode(session, node.maxRetriesNodeId);
                        } else {
                            console.log(`⚠️ No max retries node defined, stopping workflow execution`);
                            return false;
                        }
                    }
                }
                
                // Debug the data being used for condition evaluation
                console.log(`  Evaluation data:`, session.data);
                
                // Evaluate condition
                const conditionResult = evaluateCondition(node.condition, session.data);
                console.log(`  Condition result: ${conditionResult}`);
                
                // Save condition result to data for potential debugging
                if (!session.data) session.data = {};
                session.data[`${node.nodeId}_result`] = conditionResult;
                session.markModified('data');
                await session.save();
                
                // Determine next node based on condition result
                const nextNodeId = conditionResult ? node.trueNodeId : node.falseNodeId;
                
                if (nextNodeId) {
                    console.log(`⏭️ Moving to ${conditionResult ? 'true' : 'false'} node: ${nextNodeId}`);
                    
                    // Reset the execution count for the next node
                    resetNodeExecutionCount(session._id, nextNodeId);
                    
                    // Add a small delay before executing the next node
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    await executeWorkflowNode(session, nextNodeId);
                } else {
                    console.error(`❌ No ${conditionResult ? 'true' : 'false'} node defined for condition`);
                    return false;
                }
                break;
            
            case 'api':
                console.log(`  Executing API node: ${node.apiEndpoint}`);
                
                try {
                    // Initialize session data if needed
                    if (!session.data) {
                        session.data = {};
                    }
                    
                    // Special handling for KYC verification endpoints
                    if (node.apiEndpoint === '/api/verification/aadhaar') {
                        console.log('  🔍 Special handling for direct Aadhaar verification');
                        
                        try {
                            // Import KYC handlers dynamically to avoid circular dependencies
                            const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                            
                            // Process Aadhaar verification
                            const result = await kycWorkflowHandlers.verifyAadhaar(session._id);
                            console.log('  Aadhaar verification result:', result);
                            
                            // Store result in session data
                            session.data.aadhaarVerificationResult = result;
                            session.data.isAadhaarVerified = result.success;
                            if (result.success && result.aadhaarName) {
                                session.data.aadhaarName = result.aadhaarName;
                            }
                            session.markModified('data');
                            await session.save();
                        } catch (kycError) {
                            console.error('Error verifying Aadhaar:', kycError);
                            // Set verification to false on error
                            session.data.isAadhaarVerified = false;
                            session.markModified('data');
                            await session.save();
                            
                            // Go to error node if defined
                            if (node.errorNodeId) {
                                return executeWorkflowNode(session, node.errorNodeId);
                            }
                            throw kycError;
                        }
                    }
                    else if (node.apiEndpoint === '/api/verification/pan-validate') {
                        console.log('  🔍 Special handling for direct PAN verification');
                        
                        try {
                            // Import KYC handlers dynamically to avoid circular dependencies
                            const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                            
                            // Process PAN verification
                            const result = await kycWorkflowHandlers.verifyPAN(session._id);
                            console.log('  PAN verification result:', result);
                            
                            // Store result in session data
                            session.data.panVerificationResult = result;
                            session.data.isPanVerified = result.success;
                            if (result.success && result.panName) {
                                session.data.panName = result.panName;
                            }
                            session.markModified('data');
                            await session.save();
                        } catch (kycError) {
                            console.error('Error verifying PAN:', kycError);
                            // Set verification to false on error
                            session.data.isPanVerified = false;
                            session.markModified('data');
                            await session.save();
                            
                            // Go to error node if defined
                            if (node.errorNodeId) {
                                return executeWorkflowNode(session, node.errorNodeId);
                            }
                            throw kycError;
                        }
                    }
                    else if (node.apiEndpoint === '/api/verification/aadhaar-pan-link') {
                        console.log('  🔍 Special handling for Aadhaar-PAN linking check');
                        
                        try {
                            // Import KYC handlers dynamically to avoid circular dependencies
                            const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                            
                            // Check Aadhaar-PAN link
                            const result = await kycWorkflowHandlers.checkAadhaarPanLink(session._id);
                            console.log('  Aadhaar-PAN link result:', result);
                            
                            // Store result in session data
                            session.data.aadhaarPanLinkResult = result;
                            session.data.isAadhaarPanLinked = result.success && result.isLinked;
                            session.markModified('data');
                            await session.save();
                        } catch (kycError) {
                            console.error('Error checking Aadhaar-PAN link:', kycError);
                            // Set link verification to false on error
                            session.data.isAadhaarPanLinked = false;
                            session.markModified('data');
                            await session.save();
                            
                            // Go to error node if defined
                            if (node.errorNodeId) {
                                return executeWorkflowNode(session, node.errorNodeId);
                            }
                            throw kycError;
                        }
                    }
                    else if (node.apiEndpoint === '/api/verification/status') {
                        console.log('  Special handling for verification status API');
                        
                        // Get user from database
                        const user = await User.findById(session.userId);
                        if (!user) {
                            console.error(`❌ User not found: ${session.userId}`);
                            throw new Error('User not found');
                        }
                        
                        // Get verification status directly from database
                        const verificationStatus = {
                            isAadhaarVerified: user.isAadhaarVerified || false,
                            isAadhaarValidated: user.isAadhaarValidated || false,
                            isPanVerified: user.isPanVerified || false,
                            verifications: {}
                        };
                        
                        // Get verification details
                        const verifications = await Verification.find({ userId: user._id });
                        
                        // Map verifications to expected format
                        for (const verification of verifications) {
                            verificationStatus.verifications[verification.verificationType] = {
                                status: verification.status,
                                isVerified: verification.status === 'completed',
                                completedAt: verification.completedAt
                            };
                        }
                        
                        // Add to session data
                        session.data = {
                            ...session.data,
                            ...verificationStatus
                        };
                        
                        console.log(`✅ Retrieved verification status directly:`, verificationStatus);
                    } else {
                        // For other APIs, make actual HTTP call
                        
                        // Replace variables in API params
                        const params = {};
                        if (node.apiParams) {
                            for (const [key, value] of Object.entries(node.apiParams)) {
                                if (typeof value === 'string' && value.includes('{{')) {
                                    // Replace placeholders with values from session data
                                    let paramValue = value;
                                    for (const [dataKey, dataValue] of Object.entries(session.data || {})) {
                                        if (dataValue !== undefined && dataValue !== null) {
                                            const regex = new RegExp(`{{\\s*${dataKey}\\s*}}`, 'g');
                                            paramValue = paramValue.replace(regex, dataValue);
                                        }
                                    }
                                    params[key] = paramValue;
                                } else {
                                    params[key] = value;
                                }
                            }
                        }
                        
                        console.log(`  API params:`, params);
                        
                        // Get API base URL from env or use default
                        const apiBaseUrl = process.env.API_BASE_URL || '';
                        
                        // Generate auth token for API call
                        const token = generateSessionToken(session);
                        
                        // Make the API call
                        const apiResponse = await axios({
                            method: node.apiMethod || 'GET',
                            url: `${apiBaseUrl}${node.apiEndpoint}`,
                            data: node.apiMethod === 'GET' ? undefined : params,
                            params: node.apiMethod === 'GET' ? params : undefined,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        console.log(`✅ API call successful: ${node.apiEndpoint}`);
                        
                        // Store API response in session data
                        if (apiResponse.data && apiResponse.data.data) {
                            session.data = {
                                ...session.data,
                                ...apiResponse.data.data
                            };
                        }
                    }
                    
                    // Save session with updated data
                    session.markModified('data');
                    await session.save();
                    
                    // Move to next node if defined
                    if (node.nextNodeId) {
                        console.log(`⏭️ Moving to next node: ${node.nextNodeId}`);
                        
                        // Reset the execution count for the next node
                        resetNodeExecutionCount(session._id, node.nextNodeId);
                        
                        // Add delay before moving to next node
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        await executeWorkflowNode(session, node.nextNodeId);
                    } else {
                        console.log(`⚠️ No next node defined for API node ${node.nodeId}`);
                        return true;
                    }
                } catch (error) {
                    console.error(`❌ Error executing API node:`, error.message);
                    
                    // Store error in session data
                    if (!session.data) {
                        session.data = {};
                    }
                    
                    session.data.apiError = error.message;
                    session.data.apiErrorCode = error.response?.status || 500;
                    session.markModified('data');
                    await session.save();
                    
                    // IMPORTANT: Go to error node if defined, otherwise STOP execution
                    if (node.errorNodeId) {
                        console.log(`⏭️ Moving to error node: ${node.errorNodeId}`);
                        
                        // Reset the execution count for the error node
                        resetNodeExecutionCount(session._id, node.errorNodeId);
                        
                        await executeWorkflowNode(session, node.errorNodeId);
                    } else {
                        console.log(`⚠️ No error node defined, stopping workflow execution`);
                        // Do NOT continue to next node on error if no error node is defined
                        return false;
                    }
                }
                break;
                
            case 'end':
                console.log(`  Reached end node`);
                // Mark session as completed
                session.status = 'completed';
                session.completedAt = new Date();
                await session.save();
                console.log(`✅ Workflow completed`);
                return true;
                
            default:
                console.log(`⚠️ Unsupported node type: ${node.type}`);
                return false;
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Error executing workflow node:`, error);
        // Try to save session anyway
        try {
            await session.save();
        } catch (saveError) {
            console.error(`❌ Error saving session:`, saveError);
        }
        return false;
    }
}

module.exports = {
    executeWorkflowNode,
    processWorkflowInput,
    evaluateCondition
};