// Improved workflowExecutor.js - Focus on fixing webhook response handling

const { Message } = require('../models/Messages');
const { Workflow } = require('../models/Workflows');
const { UserSession } = require('../models/UserSessions');
const whatsappService = require('./whatsappServices');

// services/workflowExecutor.js - Fix the processWorkflowInput function

async function processWorkflowInput(session, input) {
    try {
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
            
            // Save the user's input to the session data
            session.data[variableName] = input;
            session.markModified('data');
            console.log(`✅ Stored input in '${variableName}': "${input}"`);
            
            // If this node has a next node, execute it
            if (currentNode.nextNodeId) {
                console.log(`⏭️ Moving to next node: ${currentNode.nextNodeId}`);
                
                // First save the session with the input
                await session.save();
                
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

async function executeWorkflowNode(session, nodeId) {
    try {
        console.log(`\n🔄 Executing workflow node for session ${session._id}`);
        console.log(`  Node ID: ${nodeId}`);
        
        // Get workflow
        const workflow = await Workflow.findById(session.workflowId);
        if (!workflow) {
            console.error(`❌ Workflow ${session.workflowId} not found`);
            return;
        }
        
        // Find node
        const node = workflow.nodes.find(n => n.nodeId === nodeId);
        if (!node) {
            console.error(`❌ Node ${nodeId} not found in workflow ${workflow._id}`);
            return;
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
                    
                    // Wait a short time to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Move to next node if defined
                    if (node.nextNodeId) {
                        const nextNode = workflow.nodes.find(n => n.nodeId === node.nextNodeId);
                        
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
                    }
                }
                
                console.log(`⏸️ Input node - waiting for variable: ${node.variableName}`);
                break;
                
            case 'condition':
                console.log(`  Evaluating condition: ${node.condition}`);
                
                // Evaluate condition
                const conditionResult = evaluateCondition(node.condition, session.data);
                console.log(`  Condition result: ${conditionResult}`);
                
                // Determine next node based on condition result
                const nextNodeId = conditionResult ? node.trueNodeId : node.falseNodeId;
                
                if (nextNodeId) {
                    console.log(`⏭️ Moving to ${conditionResult ? 'true' : 'false'} node: ${nextNodeId}`);
                    await executeWorkflowNode(session, nextNodeId);
                } else {
                    console.error(`❌ No ${conditionResult ? 'true' : 'false'} node defined for condition`);
                }
                break;
                
            default:
                console.log(`⚠️ Unsupported node type: ${node.type}`);
        }
    } catch (error) {
        console.error(`❌ Error executing workflow node:`, error);
        // Try to save session anyway
        try {
            await session.save();
        } catch (saveError) {
            console.error(`❌ Error saving session:`, saveError);
        }
    }
}

// Evaluate conditions for decision nodes
function evaluateCondition(condition, data) {
    try {
        if (!condition) return false;
        
        // Check for length conditions
        const lengthRegex = /(\w+)\.length\s*(>|<|>=|<=|==|!=)\s*(\d+)/;
        const lengthMatch = condition.match(lengthRegex);
        
        if (lengthMatch) {
            const [, field, operator, value] = lengthMatch;
            const fieldValue = data[field];
            if (!fieldValue) return false;
            
            const length = fieldValue.length;
            const compareValue = parseInt(value);
            
            switch (operator) {
                case '>': return length > compareValue;
                case '<': return length < compareValue;
                case '>=': return length >= compareValue;
                case '<=': return length <= compareValue;
                case '==': return length === compareValue;
                case '!=': return length !== compareValue;
                default: return false;
            }
        }
        
        // Check for includes conditions
        const includesRegex = /(\w+)\.includes\(['"](.+)['"]\)/;
        const includesMatch = condition.match(includesRegex);
        
        if (includesMatch) {
            const [, field, searchValue] = includesMatch;
            const fieldValue = data[field];
            return fieldValue && fieldValue.includes(searchValue);
        }
        
        // Check for comparison operators
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

module.exports = {
    executeWorkflowNode,
    processWorkflowInput,
    evaluateCondition
};