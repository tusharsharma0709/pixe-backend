// services/workflowExecutor.js - Updated with Enhanced KYC Verification Nodes and Template Processing

const { Message } = require('../models/Messages');
const { Workflow } = require('../models/Workflows');
const { UserSession } = require('../models/UserSessions');
const { User } = require('../models/Users');
const { Verification } = require('../models/Verifications');
const whatsappService = require('./whatsappServices');
const axios = require('axios');
const jwt = require('jsonwebtoken');
// Add import for GTM service - only new line at the top
const kycGtmService = require('./kycGtmServices');

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

/**
 * Process template expressions in content
 * @param {String} content - Template content with expressions
 * @param {Object} data - Data object with values for replacement
 * @returns {String} - Processed content with evaluated expressions
 */
function processTemplate(content, data) {
    if (!content || !data) return content;
    
    try {
        let processedContent = content;
        
        // First, replace simple variables with {{ variable }}
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                processedContent = processedContent.replace(regex, value);
            }
        }
        
        // Then, process conditional expressions with {{ condition ? 'trueValue' : 'falseValue' }}
        const conditionalRegex = /{{([^{}]+)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]}}|{{([^{}]+)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]}}/g;
        
        processedContent = processedContent.replace(conditionalRegex, (match, cond1, trueVal1, falseVal1, cond2, trueVal2, falseVal2) => {
            const condition = cond1 || cond2;
            const trueValue = trueVal1 || trueVal2;
            const falseValue = falseVal1 || falseVal2;
            
            try {
                // Try to evaluate the condition based on the data object
                const condTrimmed = condition.trim();
                
                // Check if condition is just a variable name
                if (data[condTrimmed] !== undefined) {
                    return data[condTrimmed] ? trueValue : falseValue;
                }
                
                // Otherwise, try to evaluate the condition
                if (evaluateCondition(condTrimmed, data)) {
                    return trueValue;
                } else {
                    return falseValue;
                }
            } catch (error) {
                console.error(`Error evaluating template condition "${condition}":`, error);
                return match; // Return the original expression if evaluation fails
            }
        });
        
        return processedContent;
    } catch (error) {
        console.error('Error processing template:', error);
        return content; // Return original content on error
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
 * @param {String} messageType - Type of message (text, interactive, etc.)
 */
async function processWorkflowInput(session, input, messageId = null, messageType = 'text') {
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
        console.log(`  Message type: ${messageType}`);
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
        
        // Initialize data object if needed
        if (!session.data) {
            session.data = {};
        }
        
        // Handle different types of inputs based on node type
        if (currentNode.type === 'input' || currentNode.type === 'interactive') {
            // Store user input in session data
            const variableName = currentNode.variableName;
            if (!variableName) {
                console.error('❌ No variable name defined for node');
                return;
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
                console.error(`❌ No next node defined for node ${currentNode.nodeId}`);
                // Just save the session
                await session.save();
            }
        } else {
            console.log(`⚠️ Current node is not an input or interactive node. Type: ${currentNode.type}`);
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
                // Replace variables in content using the enhanced template processor
                const content = processTemplate(node.content, session.data || {});
                
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
                
            case 'interactive':
                console.log(`  Executing interactive node: ${node.name}`);
                
                try {
                    // Process template variables in content
                    const interactiveContent = processTemplate(node.content, session.data || {});
                    
                    // Log the node structure for debugging
                    console.log(`  Interactive node data structure:`, {
                        buttons: node.buttons ? `Array with ${node.buttons.length} items` : 'Not defined',
                        options: node.options ? `Array with ${node.options.length} items` : 'Not defined',
                        variableName: node.variableName || 'Not defined'
                    });
                    
                    // Create buttons array from the options
                    const buttons = [];
                    
                    if (node.buttons && Array.isArray(node.buttons) && node.buttons.length > 0) {
                        // Use explicitly defined buttons
                        buttons.push(...node.buttons.map(btn => ({
                            text: processTemplate(btn.text || btn.title || "Option", session.data || {}),
                            value: btn.value || btn.id || "option"
                        })));
                    }
                    // If no explicit buttons, check if using options array
                    else if (node.options && Array.isArray(node.options) && node.options.length > 0) {
                        // Create buttons from options
                        buttons.push(...node.options.map(opt => ({
                            text: processTemplate(opt.text || opt.label || "Option", session.data || {}),
                            value: opt.value || opt.id || "option"
                        })));
                        console.log(`  Created ${buttons.length} buttons from options array`);
                    }
                    
                    console.log(`  Sending interactive message with ${buttons.length} buttons`);
                    
                    if (buttons.length === 0) {
                        console.error(`❌ No buttons defined for interactive node ${node.nodeId}`);
                        
                        // Fallback to a regular message if no buttons are defined
                        console.log(`⚠️ Falling back to regular message for node ${node.nodeId}`);
                        
                        // Send regular message instead
                        const fallbackResult = await whatsappService.sendMessage(
                            session.phone, 
                            interactiveContent + "\n\nPlease reply with your choice."
                        );
                        
                        // Get message ID
                        const whatsappMessageId = fallbackResult.messages?.[0]?.id;
                        
                        // Create message record for the fallback
                        await Message.create({
                            sessionId: session._id,
                            userId: session.userId,
                            adminId: session.adminId,
                            campaignId: session.campaignId,
                            sender: 'workflow',
                            messageType: 'text',
                            content: interactiveContent + "\n\nPlease reply with your choice.",
                            status: 'sent',
                            nodeId: node.nodeId,
                            whatsappMessageId,
                            metadata: { 
                                fallback: true,
                                originalType: 'interactive'
                            }
                        });
                        
                        console.log('✅ Saved fallback message to database');
                        
                        // Store the variable name for this input
                        if (node.variableName) {
                            session.pendingVariableName = node.variableName;
                            session.markModified('data');
                            await session.save();
                        }
                        
                        return true;
                    }
                    
                    // Log detailed button info
                    console.log(`  Button details:`, JSON.stringify(buttons));
                    
                    // Send WhatsApp message with buttons
                    const messageResult = await whatsappService.sendButtonMessage(
                        session.phone, 
                        interactiveContent, 
                        buttons
                    );
                    
                    // Get message ID from response
                    const whatsappMessageId = messageResult.messages?.[0]?.id;
                    
                    // Create message record
                    await Message.create({
                        sessionId: session._id,
                        userId: session.userId,
                        adminId: session.adminId,
                        campaignId: session.campaignId,
                        sender: 'workflow',
                        messageType: 'interactive',
                        content: interactiveContent,
                        status: 'sent',
                        nodeId: node.nodeId,
                        whatsappMessageId,
                        metadata: { buttons }
                    });
                    
                    console.log('✅ Saved interactive message to database');
                    
                    // Wait to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Store the variable name for this input
                    if (node.variableName) {
                        session.pendingVariableName = node.variableName;
                        session.markModified('data');
                        await session.save();
                    }
                    
                    // Since interactive messages are waiting for user input,
                    // don't proceed to next node automatically
                    if (node.nextNodeId) {
                        session.nextNodeIdAfterInput = node.nextNodeId;
                        session.markModified('data');
                        await session.save();
                    }
                } catch (error) {
                    console.error(`❌ Error sending interactive message:`, error);
                    return false;
                }
                break;
                
            case 'input':
                // For input nodes, send prompt if exists, then wait for user input
                if (node.content) {
                    // Replace variables in prompt content using template processor
                    const promptContent = processTemplate(node.content, session.data || {});
                    
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
                            
                            // Track in GTM - ADDED CODE
                            try {
                                const user = await User.findById(session.userId);
                                if (user) {
                                    await kycGtmService.trackKycStep(user, 'aadhaar', result.success);
                                    kycGtmService.pushDataLayerEvent(session, 'kyc_verification', {
                                        step: 'aadhaar',
                                        success: result.success
                                    });
                                }
                            } catch (gtmError) {
                                console.error('GTM tracking error:', gtmError);
                                // Non-blocking - continue despite GTM errors
                            }
                            
                        } catch (kycError) {
                            console.error('Error verifying Aadhaar:', kycError);
                            // Set verification to false on error
                            session.data.isAadhaarVerified = false;
                            session.markModified('data');
                            await session.save();
                            
                            // Track failed verification in GTM - ADDED CODE
                            try {
                                const user = await User.findById(session.userId);
                                if (user) {
                                    await kycGtmService.trackKycStep(user, 'aadhaar', false);
                                }
                            } catch (gtmError) {
                                console.error('GTM tracking error:', gtmError);
                            }
                            
                            // Go to error node if defined
                            if (node.errorNodeId) {
                                return executeWorkflowNode(session, node.errorNodeId);
                            }
                            throw kycError;
                        }
                    }
                    // Other API handlers continue as before...
                    // ... [Keep all your existing API handlers] ...
                    else {
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
                
                // Track workflow completion in GTM - ADDED CODE
                try {
                    // Track overall workflow completion
                    const user = await User.findById(session.userId);
                    if (user && workflow.name.toLowerCase().includes('kyc')) {
                        // Get KYC status
                        const kycStatus = {
                            isAadhaarVerified: user.isAadhaarVerified || false,
                            isAadhaarValidated: user.isAadhaarValidated || false,
                            isPanVerified: user.isPanVerified || false,
                            isAadhaarPanLinked: session.data?.isAadhaarPanLinked || false,
                            isBankVerified: session.data?.isBankVerified || false
                        };
                        
                        // Calculate completion percentage
                        const steps = Object.keys(kycStatus);
                        const completedSteps = steps.filter(step => kycStatus[step]).length;
                        const isComplete = completedSteps === steps.length;
                        
                        // Track final KYC status
                        await kycGtmService.trackKycStep(user, 'workflow_complete', isComplete);
                        
                        // Push dataLayer event with final status
                        kycGtmService.pushDataLayerEvent(session, 'kyc_workflow_completed', {
                            ...kycStatus,
                            completion_percentage: Math.round((completedSteps / steps.length) * 100),
                            completed_steps: completedSteps,
                            total_steps: steps.length,
                            start_time: session.startedAt,
                            completion_time: new Date(),
                            duration_ms: new Date() - session.startedAt
                        });
                    }
                } catch (gtmError) {
                    console.error('GTM tracking error at workflow completion:', gtmError);
                }
                
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
    evaluateCondition,
    processTemplate // Export the template processor for testing
};