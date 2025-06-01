// services/workflowExecutor.js - Complete implementation with unified tracking and preview functionality

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
 * PREVIEW WORKFLOW EXECUTION - NEW FUNCTION
 * Simulate workflow execution without actually sending messages or making API calls
 */
async function previewWorkflowExecution(workflow, sampleData = {}, startNodeId = null) {
    try {
        console.log(`🔍 Previewing workflow: ${workflow.name}`);
        
        const previewResult = {
            workflowId: workflow._id,
            workflowName: workflow.name,
            startNodeId: startNodeId || workflow.startNodeId,
            sampleData,
            executionPath: [],
            messages: [],
            conditions: [],
            apiCalls: [],
            variables: { ...sampleData },
            warnings: [],
            errors: [],
            totalNodes: workflow.nodes.length,
            executedNodes: 0,
            estimatedDuration: 0,
            preview: true
        };

        const visitedNodes = new Set();
        const MAX_PREVIEW_STEPS = 50; // Prevent infinite loops
        
        await previewNode(
            workflow, 
            startNodeId || workflow.startNodeId, 
            previewResult, 
            visitedNodes, 
            0, 
            MAX_PREVIEW_STEPS
        );

        // Generate summary
        previewResult.summary = {
            totalSteps: previewResult.executionPath.length,
            messageCount: previewResult.messages.length,
            conditionCount: previewResult.conditions.length,
            apiCallCount: previewResult.apiCalls.length,
            variableCount: Object.keys(previewResult.variables).length,
            hasWarnings: previewResult.warnings.length > 0,
            hasErrors: previewResult.errors.length > 0,
            estimatedExecutionTime: `${previewResult.estimatedDuration} seconds`
        };

        return previewResult;

    } catch (error) {
        console.error('Error in workflow preview:', error);
        return {
            success: false,
            error: error.message,
            preview: true
        };
    }
}

/**
 * Preview individual node execution
 */
async function previewNode(workflow, nodeId, previewResult, visitedNodes, depth, maxDepth) {
    if (depth >= maxDepth) {
        previewResult.warnings.push({
            type: 'max_depth_reached',
            message: `Maximum preview depth (${maxDepth}) reached. Possible infinite loop.`,
            nodeId
        });
        return;
    }

    if (visitedNodes.has(`${nodeId}_${depth}`)) {
        previewResult.warnings.push({
            type: 'circular_reference',
            message: `Circular reference detected at node ${nodeId}`,
            nodeId
        });
        return;
    }

    visitedNodes.add(`${nodeId}_${depth}`);

    const node = workflow.nodes.find(n => n.nodeId === nodeId);
    if (!node) {
        previewResult.errors.push({
            type: 'node_not_found',
            message: `Node ${nodeId} not found in workflow`,
            nodeId
        });
        return;
    }

    const stepStart = Date.now();
    
    // Add to execution path
    previewResult.executionPath.push({
        nodeId: node.nodeId,
        nodeName: node.name,
        nodeType: node.type,
        timestamp: new Date().toISOString(),
        depth,
        variables: { ...previewResult.variables }
    });

    previewResult.executedNodes++;

    let nextNodeId = null;

    switch (node.type) {
        case 'message':
            const messageContent = processTemplate(node.content, previewResult.variables);
            previewResult.messages.push({
                nodeId: node.nodeId,
                nodeName: node.name,
                content: messageContent,
                originalContent: node.content,
                processed: messageContent !== node.content,
                messageType: 'text',
                estimatedDelay: 2 // seconds
            });
            previewResult.estimatedDuration += 2;
            nextNodeId = node.nextNodeId;
            break;

        case 'interactive':
            const interactiveContent = processTemplate(node.content, previewResult.variables);
            const buttons = node.options || node.buttons || [];
            
            previewResult.messages.push({
                nodeId: node.nodeId,
                nodeName: node.name,
                content: interactiveContent,
                originalContent: node.content,
                processed: interactiveContent !== node.content,
                messageType: 'interactive',
                buttons: buttons.map(btn => ({
                    text: btn.text || btn.label,
                    value: btn.value || btn.id
                })),
                estimatedDelay: 3
            });
            
            previewResult.estimatedDuration += 3;
            
            // For preview, simulate user selecting first option
            if (buttons.length > 0 && node.variableName) {
                const firstOption = buttons[0];
                const selectedValue = firstOption.value || firstOption.id || firstOption.text;
                previewResult.variables[node.variableName] = selectedValue;
                
                previewResult.warnings.push({
                    type: 'simulated_user_input',
                    message: `Simulated user selecting: "${selectedValue}" for variable "${node.variableName}"`,
                    nodeId: node.nodeId
                });
            }
            
            nextNodeId = node.nextNodeId;
            break;

        case 'input':
            if (node.content) {
                const promptContent = processTemplate(node.content, previewResult.variables);
                previewResult.messages.push({
                    nodeId: node.nodeId,
                    nodeName: node.name,
                    content: promptContent,
                    originalContent: node.content,
                    processed: promptContent !== node.content,
                    messageType: 'input_prompt',
                    estimatedDelay: 1,
                    waitingForInput: true
                });
                previewResult.estimatedDuration += 1;
            }

            // Simulate user input if not already provided
            if (node.variableName && !previewResult.variables[node.variableName]) {
                const simulatedInput = `sample_${node.variableName}`;
                previewResult.variables[node.variableName] = simulatedInput;
                
                previewResult.warnings.push({
                    type: 'simulated_user_input',
                    message: `Simulated user input: "${simulatedInput}" for variable "${node.variableName}"`,
                    nodeId: node.nodeId
                });
            }
            
            nextNodeId = node.nextNodeId;
            break;

        case 'condition':
            const conditionResult = evaluateCondition(node.condition, previewResult.variables);
            
            previewResult.conditions.push({
                nodeId: node.nodeId,
                nodeName: node.name,
                condition: node.condition,
                result: conditionResult,
                variables: { ...previewResult.variables },
                trueNodeId: node.trueNodeId,
                falseNodeId: node.falseNodeId
            });

            previewResult.variables[`${node.nodeId}_result`] = conditionResult;
            nextNodeId = conditionResult ? node.trueNodeId : node.falseNodeId;
            
            if (!nextNodeId) {
                previewResult.errors.push({
                    type: 'missing_condition_path',
                    message: `No ${conditionResult ? 'true' : 'false'} path defined for condition`,
                    nodeId: node.nodeId
                });
            }
            break;

        case 'api':
            const apiCall = {
                nodeId: node.nodeId,
                nodeName: node.name,
                endpoint: node.apiEndpoint,
                method: node.apiMethod || 'GET',
                params: {},
                estimatedDelay: 3,
                simulated: true
            };

            // Process API parameters
            if (node.apiParams) {
                for (const [key, value] of Object.entries(node.apiParams)) {
                    if (typeof value === 'string' && value.includes('{{')) {
                        apiCall.params[key] = processTemplate(value, previewResult.variables);
                    } else {
                        apiCall.params[key] = value;
                    }
                }
            }

            // Simulate API response based on endpoint type
            if (node.apiEndpoint && node.apiEndpoint.includes('verification')) {
                // Simulate verification API response
                const verificationType = node.apiEndpoint.split('/').pop();
                apiCall.simulatedResponse = {
                    success: true,
                    data: {
                        verified: true,
                        verification_type: verificationType,
                        timestamp: new Date().toISOString()
                    }
                };

                // Add simulated verification data to variables
                previewResult.variables[`${verificationType}_verified`] = true;
                previewResult.variables[`${verificationType}_result`] = apiCall.simulatedResponse;
            } else {
                // Generic API response simulation
                apiCall.simulatedResponse = {
                    success: true,
                    data: { message: 'Simulated API response' }
                };
            }

            previewResult.apiCalls.push(apiCall);
            previewResult.estimatedDuration += 3;
            nextNodeId = node.nextNodeId;
            break;

        case 'end':
            previewResult.messages.push({
                nodeId: node.nodeId,
                nodeName: node.name,
                content: 'Workflow completed',
                messageType: 'system',
                isEndNode: true
            });
            return; // End execution

        default:
            previewResult.warnings.push({
                type: 'unsupported_node_type',
                message: `Unsupported node type: ${node.type}`,
                nodeId: node.nodeId
            });
            nextNodeId = node.nextNodeId;
    }

    const stepDuration = Date.now() - stepStart;
    previewResult.executionPath[previewResult.executionPath.length - 1].executionTime = stepDuration;

    // Continue to next node
    if (nextNodeId) {
        await previewNode(workflow, nextNodeId, previewResult, visitedNodes, depth + 1, maxDepth);
    } else if (node.type !== 'end') {
        previewResult.warnings.push({
            type: 'no_next_node',
            message: `No next node defined for ${node.type} node`,
            nodeId: node.nodeId
        });
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
                        
                        // Import SurePass services
                        const surepassServices = require('../services/surepassServices');
                        
                        // Handle all SurePass verification endpoints
                        if (node.apiEndpoint === '/api/verification/aadhaar-v2/generate-otp') {
                            console.log('  🔍 Generating Aadhaar OTP');
                            
                            try {
                                const aadhaarNumber = session.data.aadhaar_number || session.data.aadhaarNumber || session.data.aadhaar;
                                
                                if (!aadhaarNumber) {
                                    throw new Error('Aadhaar number not found in session data');
                                }
                                
                                const result = await surepassServices.generateAadhaarOTP(aadhaarNumber);
                                console.log('  ✅ Aadhaar OTP generation result:', JSON.stringify(result, null, 2));
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                // 🔧 FIXED: Extract client_id from the API response structure
                                let clientId = null;
                                if (result.success) {
                                    // Try different possible locations for client_id
                                    clientId = result.data?.client_id || result.client_id;
                                    
                                    if (clientId) {
                                        // Store client_id in multiple formats for compatibility
                                        session.data.client_id = clientId;
                                        session.data.aadhaarClientId = clientId;
                                        session.data.clientId = clientId;
                                        console.log('  ✅ Stored client_id in session:', clientId);
                                        console.log('  ✅ Session data after storing client_id:', {
                                            client_id: session.data.client_id,
                                            aadhaarClientId: session.data.aadhaarClientId,
                                            clientId: session.data.clientId
                                        });
                                    } else {
                                        console.error('  ❌ No client_id found in OTP generation response');
                                        console.error('  ❌ Response structure:', JSON.stringify(result, null, 2));
                                    }
                                }
                                
                                session.data.aadhaarOtpResult = result;
                                session.markModified('data');
                                await session.save();
                                
                                console.log('  ✅ Session saved successfully with client_id:', session.data.client_id);
                                
                            } catch (error) {
                                console.error('Error generating Aadhaar OTP:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }
// Add this debug section in the OTP verification part of your executeWorkflowNode function
else if (node.apiEndpoint === '/api/verification/aadhaar-v2/submit-otp') {
    console.log('  🔍 Verifying Aadhaar OTP');
    
    try {
        // 🔧 ENHANCED DEBUG: Log the complete aadhaarOtpResult structure
        console.log('  🔍 FULL DEBUG - aadhaarOtpResult:', JSON.stringify(session.data.aadhaarOtpResult, null, 2));
        
        // 🔧 FIXED: Try multiple client_id field names and check aadhaarOtpResult
        let clientId = session.data.client_id || session.data.aadhaarClientId || session.data.clientId;
        
        console.log('  🔍 Initial clientId check:', {
            client_id: session.data.client_id,
            aadhaarClientId: session.data.aadhaarClientId,
            clientId: session.data.clientId
        });
        
        // If not found in direct session data, check aadhaarOtpResult
        if (!clientId && session.data.aadhaarOtpResult) {
            console.log('  🔍 Searching in aadhaarOtpResult...');
            
            // Try different possible paths for client_id
            const otpResult = session.data.aadhaarOtpResult;
            
            console.log('  🔍 aadhaarOtpResult structure check:', {
                hasData: !!otpResult.data,
                dataClientId: otpResult.data?.client_id,
                rootClientId: otpResult.client_id,
                success: otpResult.success,
                keys: Object.keys(otpResult || {})
            });
            
            // Try multiple paths to find client_id
            clientId = otpResult.data?.client_id || 
                      otpResult.client_id || 
                      otpResult.response?.client_id ||
                      otpResult.result?.client_id;
            
            console.log('  🔍 client_id extraction attempts:', {
                'otpResult.data?.client_id': otpResult.data?.client_id,
                'otpResult.client_id': otpResult.client_id,
                'otpResult.response?.client_id': otpResult.response?.client_id,
                'otpResult.result?.client_id': otpResult.result?.client_id,
                'final_clientId': clientId
            });
            
            if (clientId) {
                // Store it for future use
                session.data.client_id = clientId;
                session.data.aadhaarClientId = clientId;
                session.data.clientId = clientId;
                session.markModified('data');
                await session.save();
                console.log('  ✅ Found and stored client_id from aadhaarOtpResult:', clientId);
            } else {
                console.error('  ❌ Could not find client_id in aadhaarOtpResult');
                console.error('  ❌ Complete aadhaarOtpResult:', JSON.stringify(otpResult, null, 2));
            }
        }
        
        const otp = session.data.otp || session.data.aadhaarOtp;
        
        console.log('  🔍 Final debug session data:', {
            client_id: session.data.client_id,
            aadhaarClientId: session.data.aadhaarClientId,
            clientId: session.data.clientId,
            otp: session.data.otp,
            aadhaarOtp: session.data.aadhaarOtp,
            hasAadhaarOtpResult: !!session.data.aadhaarOtpResult,
            aadhaarOtpResultKeys: session.data.aadhaarOtpResult ? Object.keys(session.data.aadhaarOtpResult) : [],
            allSessionDataKeys: Object.keys(session.data)
        });
        
        if (!clientId) {
            // Try one more desperate attempt - check if aadhaarOtpResult has nested structure
            if (session.data.aadhaarOtpResult) {
                const flattenObject = (obj, prefix = '') => {
                    let result = {};
                    for (let key in obj) {
                        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                            Object.assign(result, flattenObject(obj[key], prefix + key + '.'));
                        } else {
                            result[prefix + key] = obj[key];
                        }
                    }
                    return result;
                };
                
                const flattened = flattenObject(session.data.aadhaarOtpResult);
                console.log('  🔍 FLATTENED aadhaarOtpResult structure:', flattened);
                
                // Look for any key containing 'client'
                const clientKeys = Object.keys(flattened).filter(key => key.toLowerCase().includes('client'));
                console.log('  🔍 Keys containing "client":', clientKeys);
                
                if (clientKeys.length > 0) {
                    clientId = flattened[clientKeys[0]];
                    console.log('  🔍 Found client_id in flattened structure:', clientId);
                    
                    if (clientId) {
                        session.data.client_id = clientId;
                        session.data.aadhaarClientId = clientId;
                        session.data.clientId = clientId;
                        session.markModified('data');
                        await session.save();
                        console.log('  ✅ Stored client_id from flattened search:', clientId);
                    }
                }
            }
        }
        
        if (!clientId) {
            throw new Error('Client ID not found in session data after exhaustive search. Available fields: ' + Object.keys(session.data).join(', ') + '. aadhaarOtpResult structure: ' + JSON.stringify(session.data.aadhaarOtpResult, null, 2));
        }
        
        if (!otp) {
            throw new Error('OTP not found in session data');
        }
        
        console.log('  🔍 Using clientId:', clientId, 'and OTP:', otp);
        
        const result = await surepassServices.verifyAadhaarOTP(clientId, otp);
        console.log('  ✅ Aadhaar OTP verification result:', result);
        
        apiResponseTime = Date.now() - apiStartTime;
        apiSuccess = result.success;
        
        session.data.aadhaarVerificationResult = result;
        session.data.isAadhaarVerified = result.success;
        if (result.success && result.data?.full_name) {
            session.data.aadhaarName = result.data.full_name;
            session.data.aadhaarDob = result.data.dob;
            session.data.aadhaarGender = result.data.gender;
            session.data.aadhaarAddress = result.data.address;
        }
        session.markModified('data');
        await session.save();
        
        // Save to Verification model
        await Verification.create({
            userId: session.userId,
            verificationType: 'aadhaar_otp',
            verificationDetails: {
                aadhaarNumber: session.data.aadhaar_number,
                aadhaarName: result.data?.full_name,
                aadhaarDob: result.data?.dob,
                aadhaarGender: result.data?.gender,
                aadhaarAddress: result.data?.address
            },
            requestData: { client_id: clientId, otp: otp },
            responseData: result.data,
            status: result.success ? 'completed' : 'failed',
            provider: 'surepass'
        });
        
    } catch (error) {
        console.error('Error verifying Aadhaar OTP:', error);
        apiResponseTime = Date.now() - apiStartTime;
        apiSuccess = false;
        executionSuccess = false;
        executionError = error.message;
        
        session.data.apiError = error.message;
        session.markModified('data');
        await session.save();
        
        if (node.errorNodeId) {
            return executeWorkflowNode(session, node.errorNodeId);
        }
        throw error;
    }
}
                        else if (node.apiEndpoint === '/api/verification/pan') {
                            console.log('  🔍 PAN verification');
                            
                            try {
                                const panNumber = session.data.pan_number || session.data.panNumber || session.data.pan;
                                
                                if (!panNumber) {
                                    throw new Error('PAN number not found in session data');
                                }
                                
                                const result = await surepassServices.verifyPAN(panNumber);
                                console.log('  ✅ PAN verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.panVerificationResult = result;
                                session.data.isPanVerified = result.success;
                                if (result.success && result.data?.name) {
                                    session.data.panName = result.data.name;
                                    session.data.panFatherName = result.data.father_name;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'pan',
                                    verificationDetails: {
                                        panNumber: panNumber,
                                        panName: result.data?.name,
                                        panFatherName: result.data?.father_name
                                    },
                                    requestData: { pan_number: panNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error verifying PAN:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }
                        else if (node.apiEndpoint === '/api/verification/aadhaar-pan-link') {
                            console.log('  🔍 Aadhaar-PAN link check');
                            
                            try {
                                const aadhaarNumber = session.data.aadhaar_number || session.data.aadhaarNumber || session.data.aadhaar;
                                const panNumber = session.data.pan_number || session.data.panNumber || session.data.pan;
                                
                                if (!aadhaarNumber || !panNumber) {
                                    throw new Error('Aadhaar number and PAN number not found in session data');
                                }
                                
                                const result = await surepassServices.checkAadhaarPANLink(aadhaarNumber, panNumber);
                                console.log('  ✅ Aadhaar-PAN link result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.aadhaarPanLinkResult = result;
                                session.data.isAadhaarPanLinked = result.success && result.data?.link_status === 'linked';
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'aadhaar_pan_link',
                                    verificationDetails: {
                                        aadhaarNumber: aadhaarNumber,
                                        panNumber: panNumber
                                    },
                                    requestData: { aadhaar_number: aadhaarNumber, pan_number: panNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error checking Aadhaar-PAN link:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }
                        else if (node.apiEndpoint === '/api/verification/bank-verification') {
                            console.log('  🔍 Bank account verification');
                            
                            try {
                                const accountNumber = session.data.account_number || session.data.accountNumber;
                                const ifsc = session.data.ifsc || session.data.ifscCode;
                                const accountHolderName = session.data.account_holder_name || session.data.accountHolderName;
                                
                                if (!accountNumber || !ifsc) {
                                    throw new Error('Account number and IFSC code not found in session data');
                                }
                                
                                const result = await surepassServices.verifyBankAccount(accountNumber, ifsc, accountHolderName);
                                console.log('  ✅ Bank verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.bankVerificationResult = result;
                                session.data.isBankVerified = result.success;
                                if (result.success && result.data?.account_holder_name) {
                                    session.data.accountHolderName = result.data.account_holder_name;
                                    session.data.bankName = result.data.bank_name;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'bank_account',
                                    verificationDetails: {
                                        accountNumber: accountNumber,
                                        ifscCode: ifsc,
                                        accountHolderName: result.data?.account_holder_name,
                                        bankName: result.data?.bank_name
                                    },
                                    requestData: { account_number: accountNumber, ifsc: ifsc, name: accountHolderName },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error verifying bank account:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }
                        else if (node.apiEndpoint === '/api/verification/driving-license') {
                            console.log('  🔍 Driving License verification');
                            
                            try {
                                const licenseNumber = session.data.license_number || session.data.licenseNumber || session.data.driving_license_number;
                                const dob = session.data.dob || session.data.date_of_birth || session.data.dateOfBirth;
                                
                                if (!licenseNumber) {
                                    throw new Error('Driving license number not found in session data');
                                }
                                
                                if (!dob) {
                                    throw new Error('Date of birth not found in session data');
                                }
                                
                                const result = await surepassServices.verifyDrivingLicense(licenseNumber, dob);
                                console.log('  ✅ Driving License verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.drivingLicenseResult = result;
                                session.data.isDrivingLicenseVerified = result.success;
                                if (result.success && result.data) {
                                    session.data.licenseName = result.data.name;
                                    session.data.licenseState = result.data.state;
                                    session.data.licenseDoe = result.data.doe;
                                    session.data.vehicleClasses = result.data.vehicle_classes;
                                    session.data.permanentAddress = result.data.permanent_address;
                                    session.data.fatherOrHusbandName = result.data.father_or_husband_name;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'driving_license',
                                    verificationDetails: {
                                        licenseNumber: licenseNumber,
                                        licenseName: result.data?.name,
                                        licenseState: result.data?.state,
                                        licenseDob: result.data?.dob,
                                        licenseDoe: result.data?.doe,
                                        vehicleClasses: result.data?.vehicle_classes || [],
                                        permanentAddress: result.data?.permanent_address,
                                        temporaryAddress: result.data?.temporary_address,
                                        fatherOrHusbandName: result.data?.father_or_husband_name,
                                        bloodGroup: result.data?.blood_group
                                    },
                                    requestData: { license_number: licenseNumber, dob: dob },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error verifying driving license:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }

                        // NEW: 2. GSTIN Advanced Details
                        else if (node.apiEndpoint === '/api/verification/gstin-advanced') {
                            console.log('  🔍 GSTIN Advanced details lookup');
                            
                            try {
                                const gstinNumber = session.data.gstin_number || session.data.gstinNumber || session.data.gstin;
                                
                                if (!gstinNumber) {
                                    throw new Error('GSTIN number not found in session data');
                                }
                                
                                const result = await surepassServices.getGSTINAdvanced(gstinNumber);
                                console.log('  ✅ GSTIN Advanced details result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.gstinAdvancedResult = result;
                                session.data.isGstinAdvancedVerified = result.success;
                                if (result.success && result.data) {
                                    session.data.businessName = result.data.business_name;
                                    session.data.legalName = result.data.legal_name;
                                    session.data.gstinStatus = result.data.gstin_status;
                                    session.data.taxpayerType = result.data.taxpayer_type;
                                    session.data.constitutionOfBusiness = result.data.constitution_of_business;
                                    session.data.registrationDate = result.data.date_of_registration;
                                    session.data.annualTurnover = result.data.annual_turnover;
                                    session.data.principalAddress = result.data.contact_details?.principal?.address;
                                    session.data.principalEmail = result.data.contact_details?.principal?.email;
                                    session.data.principalMobile = result.data.contact_details?.principal?.mobile;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'gstin_advanced',
                                    verificationDetails: {
                                        gstinNumber: gstinNumber,
                                        businessName: result.data?.business_name,
                                        legalName: result.data?.legal_name,
                                        gstinStatus: result.data?.gstin_status,
                                        registrationDate: result.data?.date_of_registration,
                                        taxpayerType: result.data?.taxpayer_type,
                                        constitutionOfBusiness: result.data?.constitution_of_business,
                                        annualTurnover: result.data?.annual_turnover,
                                        principalBusinessAddress: result.data?.contact_details?.principal?.address,
                                        principalEmail: result.data?.contact_details?.principal?.email,
                                        principalMobile: result.data?.contact_details?.principal?.mobile
                                    },
                                    requestData: { gstin_number: gstinNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error getting GSTIN advanced details:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }

                        // NEW: 3. GSTIN List by PAN
                        else if (node.apiEndpoint === '/api/verification/gstin-by-pan') {
                            console.log('  🔍 GSTIN list by PAN lookup');
                            
                            try {
                                const panNumber = session.data.pan_number || session.data.panNumber || session.data.pan;
                                
                                if (!panNumber) {
                                    throw new Error('PAN number not found in session data');
                                }
                                
                                const result = await surepassServices.getGSTINByPAN(panNumber);
                                console.log('  ✅ GSTIN by PAN result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.gstinByPanResult = result;
                                session.data.isGstinByPanVerified = result.success;
                                if (result.success && result.data) {
                                    session.data.gstinList = result.data.gstin_list;
                                    session.data.gstinCount = result.data.gstin_list ? result.data.gstin_list.length : 0;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'gstin_by_pan',
                                    verificationDetails: {
                                        panNumber: panNumber,
                                        gstinList: result.data?.gstin_list || []
                                    },
                                    requestData: { pan_number: panNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error getting GSTIN by PAN:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }

                        // NEW: 4. Udyog Aadhaar (UDYAM) Verification
                        else if (node.apiEndpoint === '/api/verification/udyog-aadhaar') {
                            console.log('  🔍 Udyog Aadhaar (UDYAM) verification');
                            
                            try {
                                const udyamNumber = session.data.udyam_number || session.data.udyamNumber || session.data.udyog_aadhaar;
                                
                                if (!udyamNumber) {
                                    throw new Error('Udyam registration number not found in session data');
                                }
                                
                                const result = await surepassServices.verifyUdyogAadhaar(udyamNumber);
                                console.log('  ✅ Udyog Aadhaar verification result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.udyogAadhaarResult = result;
                                session.data.isUdyogAadhaarVerified = result.success;
                                if (result.success && result.data) {
                                    session.data.enterpriseName = result.data.main_details?.name_of_enterprise;
                                    session.data.majorActivity = result.data.main_details?.major_activity;
                                    session.data.enterpriseType = result.data.main_details?.enterprise_type_list?.[0]?.enterprise_type;
                                    session.data.dateOfCommencement = result.data.main_details?.date_of_commencement;
                                    session.data.organizationType = result.data.main_details?.organization_type;
                                    session.data.socialCategory = result.data.main_details?.social_category;
                                    session.data.udyamState = result.data.main_details?.state;
                                    session.data.udyamCity = result.data.main_details?.city;
                                    session.data.udyamPin = result.data.main_details?.pin;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'udyog_aadhaar',
                                    verificationDetails: {
                                        udyamNumber: udyamNumber,
                                        enterpriseName: result.data?.main_details?.name_of_enterprise,
                                        majorActivity: result.data?.main_details?.major_activity,
                                        enterpriseType: result.data?.main_details?.enterprise_type_list?.[0]?.enterprise_type,
                                        dateOfCommencement: result.data?.main_details?.date_of_commencement,
                                        organizationType: result.data?.main_details?.organization_type,
                                        socialCategory: result.data?.main_details?.social_category,
                                        udyamState: result.data?.main_details?.state,
                                        udyamCity: result.data?.main_details?.city,
                                        udyamPin: result.data?.main_details?.pin
                                    },
                                    requestData: { udyam_number: udyamNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error verifying Udyog Aadhaar:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }

                        // NEW: 5. ITR Compliance Check
                        else if (node.apiEndpoint === '/api/verification/itr-compliance') {
                            console.log('  🔍 ITR Compliance check');
                            
                            try {
                                const panNumber = session.data.pan_number || session.data.panNumber || session.data.pan;
                                
                                if (!panNumber) {
                                    throw new Error('PAN number not found in session data');
                                }
                                
                                const result = await surepassServices.checkITRCompliance(panNumber);
                                console.log('  ✅ ITR Compliance check result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.itrComplianceResult = result;
                                session.data.isItrCompliant = result.success && result.data?.compliant;
                                if (result.success && result.data) {
                                    session.data.panCompliant = result.data.compliant;
                                    session.data.panAllotmentDate = result.data.pan_allotment_date;
                                    session.data.maskedName = result.data.masked_name;
                                    session.data.panAadhaarLinked = result.data.pan_aadhaar_linked;
                                    session.data.panStatus = result.data.pan_status;
                                    session.data.validPan = result.data.valid_pan;
                                    session.data.specifiedPersonUnder206 = result.data.specified_person_under_206;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'itr_compliance',
                                    verificationDetails: {
                                        panNumber: panNumber,
                                        panCompliant: result.data?.compliant,
                                        panAllotmentDate: result.data?.pan_allotment_date,
                                        maskedName: result.data?.masked_name,
                                        panAadhaarLinked: result.data?.pan_aadhaar_linked,
                                        panStatus: result.data?.pan_status,
                                        validPan: result.data?.valid_pan,
                                        specifiedPersonUnder206: result.data?.specified_person_under_206
                                    },
                                    requestData: { pan_number: panNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error checking ITR compliance:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
                            }
                        }

                        // NEW: 6. RC Full Details
                        else if (node.apiEndpoint === '/api/verification/rc-full-details') {
                            console.log('  🔍 RC Full details lookup');
                            
                            try {
                                const rcNumber = session.data.rc_number || session.data.rcNumber || session.data.vehicle_registration;
                                
                                if (!rcNumber) {
                                    throw new Error('Vehicle registration number not found in session data');
                                }
                                
                                const result = await surepassServices.getRCFullDetails(rcNumber);
                                console.log('  ✅ RC Full details result:', result);
                                
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = result.success;
                                
                                session.data.rcFullDetailsResult = result;
                                session.data.isRcFullDetailsVerified = result.success;
                                if (result.success && result.data) {
                                    session.data.ownerName = result.data.owner_name;
                                    session.data.rcFatherName = result.data.father_name;
                                    session.data.vehicleCategory = result.data.vehicle_category;
                                    session.data.vehicleChasiNumber = result.data.vehicle_chasi_number;
                                    session.data.vehicleEngineNumber = result.data.vehicle_engine_number;
                                    session.data.makerDescription = result.data.maker_description;
                                    session.data.makerModel = result.data.maker_model;
                                    session.data.fuelType = result.data.fuel_type;
                                    session.data.vehicleColor = result.data.color;
                                    session.data.manufacturingDate = result.data.manufacturing_date;
                                    session.data.rcRegistrationDate = result.data.registration_date;
                                    session.data.financer = result.data.financer;
                                    session.data.financed = result.data.financed;
                                    session.data.insuranceCompany = result.data.insurance_company;
                                    session.data.insurancePolicyNumber = result.data.insurance_policy_number;
                                    session.data.insuranceUpto = result.data.insurance_upto;
                                }
                                session.markModified('data');
                                await session.save();
                                
                                // Save to Verification model
                                await Verification.create({
                                    userId: session.userId,
                                    verificationType: 'rc_full_details',
                                    verificationDetails: {
                                        rcNumber: rcNumber,
                                        ownerName: result.data?.owner_name,
                                        rcFatherName: result.data?.father_name,
                                        vehicleCategory: result.data?.vehicle_category,
                                        vehicleChasiNumber: result.data?.vehicle_chasi_number,
                                        vehicleEngineNumber: result.data?.vehicle_engine_number,
                                        makerDescription: result.data?.maker_description,
                                        makerModel: result.data?.maker_model,
                                        bodyType: result.data?.body_type,
                                        fuelType: result.data?.fuel_type,
                                        vehicleColor: result.data?.color,
                                        manufacturingDate: result.data?.manufacturing_date,
                                        rcRegistrationDate: result.data?.registration_date,
                                        financer: result.data?.financer,
                                        financed: result.data?.financed,
                                        insuranceCompany: result.data?.insurance_company,
                                        insurancePolicyNumber: result.data?.insurance_policy_number,
                                        insuranceUpto: result.data?.insurance_upto,
                                        fitUpTo: result.data?.fit_up_to,
                                        taxUpTo: result.data?.tax_upto,
                                        permitNumber: result.data?.permit_number,
                                        permitType: result.data?.permit_type,
                                        permitValidUpto: result.data?.permit_valid_upto,
                                        seatCapacity: result.data?.seat_capacity,
                                        cubicCapacity: result.data?.cubic_capacity,
                                        vehicleGrossWeight: result.data?.vehicle_gross_weight,
                                        unladenWeight: result.data?.unladen_weight,
                                        rcStatus: result.data?.rc_status
                                    },
                                    requestData: { rc_number: rcNumber },
                                    responseData: result.data,
                                    status: result.success ? 'completed' : 'failed',
                                    provider: 'surepass'
                                });
                                
                            } catch (error) {
                                console.error('Error getting RC full details:', error);
                                apiResponseTime = Date.now() - apiStartTime;
                                apiSuccess = false;
                                executionSuccess = false;
                                executionError = error.message;
                                
                                session.data.apiError = error.message;
                                session.markModified('data');
                                await session.save();
                                
                                if (node.errorNodeId) {
                                    return executeWorkflowNode(session, node.errorNodeId);
                                }
                                throw error;
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
    processTemplate,
    previewWorkflowExecution // Export the new preview function
};