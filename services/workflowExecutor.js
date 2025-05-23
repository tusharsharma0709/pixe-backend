// services/workflowExecutor.js - Complete implementation with unified tracking

const { Message } = require('../models/Messages');
const { Workflow } = require('../models/Workflows');
const { UserSession } = require('../models/UserSessions');
const { User } = require('../models/Users');
const { Verification } = require('../models/Verifications');
const whatsappService = require('./whatsappServices');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// UNIFIED: Import the single unified tracking service
const unifiedGtmService = require('./gtmTrackingServices');

// Store recently processed message IDs to prevent duplicate processing
const recentProcessedMessages = new Map();

// Track node execution counts to prevent infinite loops
const nodeExecutionCounts = new Map();

// Helper functions
function incrementNodeExecutionCount(key) {
    const count = nodeExecutionCounts.get(key) || 0;
    nodeExecutionCounts.set(key, count + 1);
    
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
        
        if (!data) {
            console.error('❌ No data provided for condition evaluation');
            return false;
        }
        
        console.log(`  Evaluating: "${condition}" with data:`, data);
        
        // Length conditions
        const lengthRegex = /(\w+)\.replace\([^)]+\)\.length\s*(==|!=|>|<|>=|<=)\s*(\d+)/;
        const lengthMatch = condition.match(lengthRegex);
        
        if (lengthMatch) {
            const [, fieldName, operator, expectedLength] = lengthMatch;
            let fieldValue = data[fieldName];
            
            if (fieldValue === undefined || fieldValue === null) {
                return false;
            }
            
            fieldValue = String(fieldValue).replace(/\s+/g, '');
            const actualLength = fieldValue.length;
            const expectedLengthNum = parseInt(expectedLength);
            
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
        
        // Boolean values
        if (condition === 'true') return true;
        if (condition === 'false') return false;
        
        if (data[condition] !== undefined) {
            return Boolean(data[condition]);
        }
        
        // Comparison operators
        const compareRegex = /(\w+)\s*(>|<|>=|<=|==|!=)\s*([\w"']+)/;
        const compareMatch = condition.match(compareRegex);
        
        if (compareMatch) {
            const [, field, operator, valueStr] = compareMatch;
            const fieldValue = data[field];
            
            let value;
            if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
                value = valueStr.substring(1, valueStr.length - 1);
            } else if (valueStr === 'true') {
                value = true;
            } else if (valueStr === 'false') {
                value = false;
            } else if (!isNaN(Number(valueStr))) {
                value = Number(valueStr);
            } else {
                value = data[valueStr];
            }
            
            console.log(`  Comparing: ${field} (${fieldValue}) ${operator} ${value}`);
            
            switch (operator) {
                case '>': return fieldValue > value;
                case '<': return fieldValue < value;
                case '>=': return fieldValue >= value;
                case '<=': return fieldValue <= value;
                case '==': return fieldValue == value;
                case '!=': return fieldValue != value;
                default: return false;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
    }
}

function processTemplate(content, data) {
    if (!content || !data) return content;
    
    try {
        let processedContent = content;
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                processedContent = processedContent.replace(regex, value);
            }
        }
        
        const conditionalRegex = /{{([^{}]+)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]}}|{{([^{}]+)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]}}/g;
        
        processedContent = processedContent.replace(conditionalRegex, (match, cond1, trueVal1, falseVal1, cond2, trueVal2, falseVal2) => {
            const condition = cond1 || cond2;
            const trueValue = trueVal1 || trueVal2;
            const falseValue = falseVal1 || falseVal2;
            
            try {
                const condTrimmed = condition.trim();
                
                if (data[condTrimmed] !== undefined) {
                    return data[condTrimmed] ? trueValue : falseValue;
                }
                
                if (evaluateCondition(condTrimmed, data)) {
                    return trueValue;
                } else {
                    return falseValue;
                }
            } catch (error) {
                console.error(`Error evaluating template condition "${condition}":`, error);
                return match;
            }
        });
        
        return processedContent;
    } catch (error) {
        console.error('Error processing template:', error);
        return content;
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
 */
async function processWorkflowInput(session, input, messageId = null, messageType = 'text') {
    try {
        // Check for duplicate message processing
        if (messageId) {
            const key = `${session._id}:${messageId}`;
            if (recentProcessedMessages.has(key)) {
                console.log(`⚠️ Skipping duplicate message processing: ${messageId}`);
                return;
            }
            
            recentProcessedMessages.set(key, Date.now());
            
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
            const variableName = currentNode.variableName;
            if (!variableName) {
                console.error('❌ No variable name defined for node');
                return;
            }
            
            // Save the user's input to the session data
            session.data[variableName] = input;
            session.markModified('data');
            console.log(`✅ Stored input in '${variableName}': "${input}"`);
            
            // UNIFIED: Track user input with unified service
            try {
                await unifiedGtmService.trackUserInput(
                    session, 
                    variableName, 
                    input, 
                    currentNode.nodeId, 
                    currentNode.name
                );
            } catch (trackingError) {
                console.error('Unified GTM tracking error for user input:', trackingError);
                // Non-blocking - continue despite tracking errors
            }
            
            // Continue with next node
            if (currentNode.nextNodeId) {
                console.log(`⏭️ Moving to next node: ${currentNode.nextNodeId}`);
                
                await session.save();
                resetNodeExecutionCount(session._id, currentNode.nextNodeId);
                await new Promise(resolve => setTimeout(resolve, 500));
                await executeWorkflowNode(session, currentNode.nextNodeId);
            } else {
                console.error(`❌ No next node defined for node ${currentNode.nodeId}`);
                await session.save();
            }
        } else {
            console.log(`⚠️ Current node is not an input or interactive node. Type: ${currentNode.type}`);
            await session.save();
        }
    } catch (error) {
        console.error(`❌ Error processing workflow input:`, error);
        try {
            await session.save();
        } catch (saveError) {
            console.error('❌ Error saving session:', saveError);
        }
    }
}

/**
 * Execute a workflow node with unified tracking
 */
async function executeWorkflowNode(session, nodeId) {
    const startTime = Date.now(); // Track execution time
    
    try {
        console.log(`\n🔄 Executing workflow node for session ${session._id}`);
        console.log(`  Node ID: ${nodeId}`);
        
        // Check for excessive node executions (loop prevention)
        const sessionNodeKey = `${session._id}:${nodeId}`;
        const executionCount = incrementNodeExecutionCount(sessionNodeKey);
        
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
        
        let executionSuccess = true;
        let executionError = null;
        
        // Execute node based on type
        try {
            switch (node.type) {
                case 'message':
                    const content = processTemplate(node.content, session.data || {});
                    console.log(`  Sending message: "${content}"`);
                    
                    try {
                        const messageResult = await whatsappService.sendMessage(session.phone, content);
                        console.log('✅ WhatsApp API response:', JSON.stringify(messageResult));
                        
                        const whatsappMessageId = messageResult.messages?.[0]?.id;
                        
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
                        
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        if (node.nextNodeId) {
                            const nextNode = workflow.nodes.find(n => n.nodeId === node.nextNodeId);
                            resetNodeExecutionCount(session._id, node.nextNodeId);
                            
                            if (nextNode && nextNode.type === 'input') {
                                console.log(`⏸️ Next node is input type. Waiting for user response...`);
                                
                                if (nextNode.content) {
                                    console.log(`📤 Sending input prompt message`);
                                    await executeWorkflowNode(session, node.nextNodeId);
                                } else {
                                    session.currentNodeId = node.nextNodeId;
                                    await session.save();
                                }
                            } else if (nextNode) {
                                console.log(`⏭️ Moving to next node: ${node.nextNodeId}`);
                                await executeWorkflowNode(session, node.nextNodeId);
                            }
                        } else {
                            console.log(`⚠️ No next node defined for message node ${node.nodeId}`);
                        }
                    } catch (error) {
                        console.error(`❌ Error sending message:`, error);
                        executionSuccess = false;
                        executionError = error.message;
                        return false;
                    }
                    break;
                    
                case 'interactive':
                    console.log(`  Executing interactive node: ${node.name}`);
                    
                    try {
                        const interactiveContent = processTemplate(node.content, session.data || {});
                        const buttons = [];
                        
                        if (node.options && Array.isArray(node.options) && node.options.length > 0) {
                            console.log(`  Found ${node.options.length} options in node`);
                            
                            for (const option of node.options) {
                                if (option && (option.text || option.label)) {
                                    buttons.push({
                                        text: option.text || option.label,
                                        value: option.value || option.id || option.text
                                    });
                                }
                            }
                        }
                        else if (node.buttons && Array.isArray(node.buttons) && node.buttons.length > 0) {
                            console.log(`  Found ${node.buttons.length} buttons in node`);
                            
                            for (const button of node.buttons) {
                                if (button && (button.text || button.title)) {
                                    buttons.push({
                                        text: button.text || button.title,
                                        value: button.value || button.id || button.text
                                    });
                                }
                            }
                        }
                        
                        console.log(`  Final buttons prepared: ${buttons.length}`);
                        
                        if (buttons.length === 0) {
                            console.error(`❌ No buttons available for interactive node ${node.nodeId}`);
                            console.log(`⚠️ Falling back to regular message for node ${node.nodeId}`);
                            
                            const fallbackResult = await whatsappService.sendMessage(
                                session.phone, 
                                interactiveContent + "\n\nPlease reply with your choice."
                            );
                            
                            const whatsappMessageId = fallbackResult.messages?.[0]?.id;
                            
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
                            
                            if (node.variableName) {
                                session.pendingVariableName = node.variableName;
                                session.markModified('data');
                                await session.save();
                            }
                            
                            return true;
                        }
                        
                        console.log(`  Sending interactive message with ${buttons.length} buttons`);
                        const messageResult = await whatsappService.sendButtonMessage(
                            session.phone, 
                            interactiveContent, 
                            buttons
                        );
                        
                        console.log(`✅ WhatsApp API response:`, messageResult);
                        
                        const whatsappMessageId = messageResult.messages?.[0]?.id;
                        
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
                        
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        if (node.variableName) {
                            session.pendingVariableName = node.variableName;
                            session.markModified('data');
                            await session.save();
                        }
                        
                        if (node.nextNodeId) {
                            session.nextNodeIdAfterInput = node.nextNodeId;
                            session.markModified('data');
                            await session.save();
                        }
                        
                        return true;
                    } catch (error) {
                        console.error(`❌ Error sending interactive message:`, error);
                        executionSuccess = false;
                        executionError = error.message;
                        return false;
                    }
                    break;
                        
                case 'input':
                    if (node.content) {
                        const promptContent = processTemplate(node.content, session.data || {});
                        console.log(`  Sending input prompt: "${promptContent}"`);
                        
                        try {
                            const promptResult = await whatsappService.sendMessage(session.phone, promptContent);
                            const whatsappMessageId = promptResult.messages?.[0]?.id;
                            
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
                            executionSuccess = false;
                            executionError = error.message;
                            return false;
                        }
                    }
                    
                    console.log(`⏸️ Input node - waiting for variable: ${node.variableName}`);
                    break;
                    
                case 'condition':
                    console.log(`  Evaluating condition: ${node.condition}`);
                    
                    if (node.maxRetries) {
                        if (!session.data) session.data = {};
                        if (!session.data.retryCount) session.data.retryCount = {};
                        if (!session.data.retryCount[node.nodeId]) session.data.retryCount[node.nodeId] = 0;
                        
                        session.data.retryCount[node.nodeId]++;
                        session.markModified('data');
                        
                        console.log(`  Retry count for node ${node.nodeId}: ${session.data.retryCount[node.nodeId]}/${node.maxRetries}`);
                        
                        if (session.data.retryCount[node.nodeId] > node.maxRetries) {
                            console.log(`⚠️ Max retries (${node.maxRetries}) reached for condition node ${node.nodeId}`);
                            
                            if (node.maxRetriesNodeId) {
                                console.log(`⏭️ Moving to max retries node: ${node.maxRetriesNodeId}`);
                                resetNodeExecutionCount(session._id, node.maxRetriesNodeId);
                                return executeWorkflowNode(session, node.maxRetriesNodeId);
                            } else {
                                console.log(`⚠️ No max retries node defined, stopping workflow execution`);
                                return false;
                            }
                        }
                    }
                    
                    console.log(`  Evaluation data:`, session.data);
                    
                    const conditionResult = evaluateCondition(node.condition, session.data);
                    console.log(`  Condition result: ${conditionResult}`);
                    
                    // UNIFIED: Track condition evaluation
                    try {
                        await unifiedGtmService.trackConditionEvaluation(
                            session, 
                            node.condition, 
                            conditionResult, 
                            node.nodeId, 
                            node.name, 
                            conditionResult ? node.trueNodeId : node.falseNodeId
                        );
                    } catch (trackingError) {
                        console.error('Unified GTM tracking error for condition evaluation:', trackingError);
                    }
                    
                    if (!session.data) session.data = {};
                    session.data[`${node.nodeId}_result`] = conditionResult;
                    session.markModified('data');
                    await session.save();
                    
                    const nextNodeId = conditionResult ? node.trueNodeId : node.falseNodeId;
                    
                    if (nextNodeId) {
                        console.log(`⏭️ Moving to ${conditionResult ? 'true' : 'false'} node: ${nextNodeId}`);
                        resetNodeExecutionCount(session._id, nextNodeId);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await executeWorkflowNode(session, nextNodeId);
                    } else {
                        console.error(`❌ No ${conditionResult ? 'true' : 'false'} node defined for condition`);
                        executionSuccess = false;
                        executionError = `No ${conditionResult ? 'true' : 'false'} node defined`;
                        return false;
                    }
                    break;
                
                case 'api':
                    console.log(`  Executing API node: ${node.apiEndpoint}`);
                    
                    const apiStartTime = Date.now();
                    let apiSuccess = true;
                    let apiResponseTime = 0;
                    
                    try {
                        if (!session.data) {
                            session.data = {};
                        }
                        
                        // Special handling for SurePass KYC verification endpoints
                        if (node.apiEndpoint === '/api/verification/aadhaar') {
                            console.log('  🔍 Special handling for SurePass Aadhaar verification');
                            
                            try {
                                const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                                const result = await kycWorkflowHandlers.verifyAadhaar(session._id);
                                console.log('  Aadhaar verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.aadhaarVerificationResult = result;
                                session.data.isAadhaarVerified = result.success;
                                if (result.success && result.aadhaarName) {
                                    session.data.aadhaarName = result.aadhaarName;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track KYC step using unified service
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'aadhaar', 
                                            result.success, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                verification_type: 'api_verification',
                                                provider: 'surepass',
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                            } catch (kycError) {
                                console.error('Error verifying Aadhaar:', kycError);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                
                                session.data.isAadhaarVerified = false;
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track failed KYC step
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'aadhaar', 
                                            false, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                error: kycError.message,
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                                executionSuccess = false;
                                executionError = kycError.message;
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw kycError;
                            }
                        }
                        // Handle other SurePass endpoints
                        else if (node.apiEndpoint === '/api/verification/pan') {
                            console.log('  🔍 Special handling for SurePass PAN verification');
                            
                            try {
                                const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                                const result = await kycWorkflowHandlers.verifyPan(session._id);
                                console.log('  PAN verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.panVerificationResult = result;
                                session.data.isPanVerified = result.success;
                                if (result.success && result.panName) {
                                    session.data.panName = result.panName;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track PAN verification
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'pan', 
                                            result.success, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                verification_type: 'api_verification',
                                                provider: 'surepass',
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                            } catch (kycError) {
                                console.error('Error verifying PAN:', kycError);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                
                                session.data.isPanVerified = false;
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track failed PAN verification
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'pan', 
                                            false, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                error: kycError.message,
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                                executionSuccess = false;
                                executionError = kycError.message;
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw kycError;
                            }
                        }
                        // Handle bank account verification
                        else if (node.apiEndpoint === '/api/verification/bank-account') {
                            console.log('  🔍 Special handling for SurePass Bank Account verification');
                            
                            try {
                                const kycWorkflowHandlers = require('./kycWorkflowHandlers');
                                const result = await kycWorkflowHandlers.verifyBankAccount(session._id);
                                console.log('  Bank account verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.bankVerificationResult = result;
                                session.data.isBankVerified = result.success;
                                if (result.success && result.accountHolderName) {
                                    session.data.accountHolderName = result.accountHolderName;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track bank verification
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'bank_account', 
                                            result.success, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                verification_type: 'api_verification',
                                                provider: 'surepass',
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                            } catch (kycError) {
                                console.error('Error verifying bank account:', kycError);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                
                                session.data.isBankVerified = false;
                                session.markModified('data');
                                await session.save();
                                
                                // UNIFIED: Track failed bank verification
                                try {
                                    const user = await User.findById(session.userId);
                                    if (user) {
                                        await unifiedGtmService.trackKycStep(
                                            user, 
                                            'bank_account', 
                                            false, 
                                            {
                                                session: session,
                                                execution_time_ms: apiResponseTime,
                                                error: kycError.message,
                                                api_endpoint: node.apiEndpoint
                                            }
                                        );
                                    }
                                } catch (gtmError) {
                                    console.error('Unified GTM tracking error:', gtmError);
                                }
                                
                                executionSuccess = false;
                                executionError = kycError.message;
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw kycError;
                            }
                        }
                        else {
                            // For other APIs, make actual HTTP call
                            const params = {};
                            if (node.apiParams) {
                                for (const [key, value] of Object.entries(node.apiParams)) {
                                    if (typeof value === 'string' && value.includes('{{')) {
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
                            
                            const apiBaseUrl = process.env.API_BASE_URL || '';
                            const token = generateSessionToken(session);
                            
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
                            
                            apiResponseTime = Date.now() - apiStartTime;
                            console.log(`✅ API call successful: ${node.apiEndpoint}`);
                            
                            if (apiResponse.data && apiResponse.data.data) {
                                session.data = {
                                    ...session.data,
                                    ...apiResponse.data.data
                                };
                            }
                        }
                        
                        // UNIFIED: Track API call
                        try {
                            await unifiedGtmService.trackApiCall(
                                session, 
                                node.apiEndpoint, 
                                node.apiMethod || 'GET', 
                                apiSuccess, 
                                apiResponseTime, 
                                node.nodeId, 
                                node.name
                            );
                        } catch (trackingError) {
                            console.error('Unified GTM tracking error for API call:', trackingError);
                        }
                        
                        session.markModified('data');
                        await session.save();
                        
                        if (node.nextNodeId) {
                            console.log(`⏭️ Moving to next node: ${node.nextNodeId}`);
                            resetNodeExecutionCount(session._id, node.nextNodeId);
                            await new Promise(resolve => setTimeout(resolve, 500));
                            await executeWorkflowNode(session, node.nextNodeId);
                        } else {
                            console.log(`⚠️ No next node defined for API node ${node.nodeId}`);
                            return true;
                        }
                    } catch (error) {
                        console.error(`❌ Error executing API node:`, error.message);
                        
                        apiResponseTime = Date.now() - apiStartTime;
                        apiSuccess = false;
                        executionSuccess = false;
                        executionError = error.message;
                        
                        // UNIFIED: Track failed API call
                        try {
                            await unifiedGtmService.trackApiCall(
                                session, 
                                node.apiEndpoint, 
                                node.apiMethod || 'GET', 
                                false, 
                                apiResponseTime, 
                                node.nodeId, 
                                node.name
                            );
                        } catch (trackingError) {
                            console.error('Unified GTM tracking error for failed API call:', trackingError);
                        }
                        
                        if (!session.data) {
                            session.data = {};
                        }
                        
                        session.data.apiError = error.message;
                        session.data.apiErrorCode = error.response?.status || 500;
                        session.markModified('data');
                        await session.save();
                        
                        if (node.errorNodeId) {
                            console.log(`⏭️ Moving to error node: ${node.errorNodeId}`);
                            resetNodeExecutionCount(session._id, node.errorNodeId);
                            await executeWorkflowNode(session, node.errorNodeId);
                        } else {
                            console.log(`⚠️ No error node defined, stopping workflow execution`);
                            return false;
                        }
                    }
                    break;
                    
                case 'end':
                    console.log(`  Reached end node`);
                    
                    // UNIFIED: Track workflow completion
                    try {
                        const totalExecutionTime = Date.now() - (session.startedAt ? session.startedAt.getTime() : Date.now());
                        await unifiedGtmService.trackWorkflowCompletion(session, workflow, totalExecutionTime);
                    } catch (gtmError) {
                        console.error('Unified GTM tracking error at workflow completion:', gtmError);
                    }
                    
                    session.status = 'completed';
                    session.completedAt = new Date();
                    await session.save();
                    console.log(`✅ Workflow completed`);
                    return true;
                    
                default:
                    console.log(`⚠️ Unsupported node type: ${node.type}`);
                    executionSuccess = false;
                    executionError = `Unsupported node type: ${node.type}`;
                    return false;
            }
        } catch (nodeError) {
            executionSuccess = false;
            executionError = nodeError.message;
            throw nodeError;
        }
        
        // UNIFIED: Track node execution completion
        try {
            const executionTime = Date.now() - startTime;
            await unifiedGtmService.trackNodeExecution(
                session, 
                node, 
                executionTime, 
                executionSuccess, 
                executionError
            );
        } catch (trackingError) {
            console.error('Unified GTM tracking error for node execution:', trackingError);
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Error executing workflow node:`, error);
        
        // UNIFIED: Track failed node execution
        try {
            const executionTime = Date.now() - startTime;
            await unifiedGtmService.trackNodeExecution(
                session, 
                { nodeId, name: 'Unknown Node', type: 'unknown' }, 
                executionTime, 
                false, 
                error.message
            );
        } catch (trackingError) {
            console.error('Unified GTM tracking error for failed node execution:', trackingError);
        }
        
        try {
            await session.save();
        } catch (saveError) {
            console.error(`❌ Error saving session:`, saveError);
        }
        return false;
    }
}

/**
 * Start workflow execution with unified tracking
 */
async function startWorkflowExecution(session, startNodeId = null) {
    try {
        console.log(`🚀 Starting workflow execution for session ${session._id}`);
        
        const workflow = await Workflow.findById(session.workflowId);
        if (!workflow) {
            console.error(`❌ Workflow ${session.workflowId} not found`);
            return false;
        }
        
        // UNIFIED: Track workflow start
        try {
            await unifiedGtmService.trackWorkflowStart(session, workflow);
        } catch (trackingError) {
            console.error('Unified GTM tracking error for workflow start:', trackingError);
        }
        
        const nodeToExecute = startNodeId || workflow.startNodeId;
        
        if (!nodeToExecute) {
            console.error(`❌ No start node ID available for workflow ${workflow._id}`);
            return false;
        }
        
        session.status = 'active';
        session.startedAt = new Date();
        await session.save();
        
        return await executeWorkflowNode(session, nodeToExecute);
    } catch (error) {
        console.error(`❌ Error starting workflow execution:`, error);
        
        try {
            session.status = 'abandoned';
            await session.save();
        } catch (saveError) {
            console.error(`❌ Error saving session status:`, saveError);
        }
        
        return false;
    }
}

module.exports = {
    executeWorkflowNode,
    processWorkflowInput,
    startWorkflowExecution,
    evaluateCondition,
    processTemplate
};// services/workflowExecutor.js - Complete implementation with unified tracking