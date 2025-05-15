// services/WorkflowExecutor.js
const { Message } = require('../models/Messages');
const { Workflow } = require('../models/Workflows');
const { UserSession } = require('../models/UserSessions');
const whatsappService = require('./whatsappServices');

async function executeWorkflowNode(session, nodeId) {
    const workflow = await Workflow.findById(session.workflowId);
    const node = workflow.nodes.find(n => n.nodeId === nodeId);
    
    if (!node) {
        console.error(`Node ${nodeId} not found in workflow ${workflow._id}`);
        return;
    }
    
    console.log(`Executing node: ${node.name} (${node.type})`);
    
    switch (node.type) {
        case 'message':
            // Replace variables in content
            let content = node.content;
            for (const [key, value] of Object.entries(session.data || {})) {
                content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
            
            try {
                // Send WhatsApp message
                console.log(`Sending message to ${session.phone}: ${content}`);
                await whatsappService.sendMessage(session.phone, content);
                
                // Save bot message
                await Message.create({
                    sessionId: session._id,
                    userId: session.userId,
                    adminId: session.adminId,
                    sender: 'workflow',
                    messageType: 'text',
                    content: content,
                    status: 'sent',
                    nodeId: node.nodeId
                });
                
                console.log('Message sent successfully');
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error('Error sending message:', error);
                // Handle rate limit errors
                if (error.message?.includes('131056')) {
                    console.log('Rate limit hit, waiting 30 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
                throw error;
            }
            
            // Move to next node
            if (node.nextNodeId) {
                session.currentNodeId = node.nextNodeId;
                await session.save();
                
                // Check if next node is input type
                const nextNode = workflow.nodes.find(n => n.nodeId === node.nextNodeId);
                if (nextNode && nextNode.type === 'input') {
                    // Stop here and wait for user input
                    console.log('Next node is input, waiting for user response');
                    return;
                } else if (nextNode) {
                    // Continue execution
                    await executeWorkflowNode(session, node.nextNodeId);
                }
            }
            break;
            
        case 'input':
            // Update current node and wait for user input
            session.currentNodeId = nodeId;
            await session.save();
            console.log(`Waiting for input: ${node.variableName}`);
            break;
            
        case 'condition':
            // Evaluate condition
            const result = evaluateCondition(node.condition, session.data);
            console.log(`Condition ${node.condition} evaluated to: ${result}`);
            const nextNodeId = result ? node.trueNodeId : node.falseNodeId;
            await executeWorkflowNode(session, nextNodeId);
            break;
    }
}

function evaluateCondition(condition, data) {
    try {
        const lengthRegex = /(\w+)\.length\s*(>|<|>=|<=)\s*(\d+)/;
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
            }
        }
        
        const includesRegex = /(\w+)\.includes\(['"](.+)['"]\)/;
        const includesMatch = condition.match(includesRegex);
        
        if (includesMatch) {
            const [, field, searchValue] = includesMatch;
            const fieldValue = data[field];
            return fieldValue && fieldValue.includes(searchValue);
        }
        
        return false;
    } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
    }
}

async function processWorkflowInput(session, input) {
    const workflow = await Workflow.findById(session.workflowId);
    const currentNode = workflow.nodes.find(n => n.nodeId === session.currentNodeId);
    
    if (!currentNode) return;
    
    if (currentNode.type === 'input') {
        // Store user input in session data
        session.data[currentNode.variableName] = input;
        session.markModified('data');
        await session.save();
        
        console.log(`Stored ${currentNode.variableName}: ${input}`);
        
        // Move to next node and execute
        if (currentNode.nextNodeId) {
            await executeWorkflowNode(session, currentNode.nextNodeId);
        }
    }
}

module.exports = {
    executeWorkflowNode,
    processWorkflowInput,
    evaluateCondition
};