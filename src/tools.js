import { createAgentRegistry } from './lib/agentRegistry.js';
import { createMessageStore } from './lib/messageStore.js';
import { createNotificationManager } from './lib/notificationManager.js';
import { createInstanceTracker } from './lib/instanceTracker.js';
import { Errors, MCPError } from './errors.js';
import { textResponse, structuredResponse, createMetadata } from './response-formatter.js';
import * as path from 'path';

// Initialize storage paths
const STORAGE_DIR = process.env.NODE_ENV === 'test' 
  ? `/tmp/mcp-agentic-framework-test-${process.pid}-${Date.now()}`
  : '/tmp/mcp-agentic-framework';
const AGENTS_STORAGE = path.join(STORAGE_DIR, 'agents.json');
const MESSAGES_DIR = path.join(STORAGE_DIR, 'messages');

// Create notification manager first
let notificationManager = createNotificationManager();

// Create instances - these will be reset in tests
let agentRegistry = createAgentRegistry(AGENTS_STORAGE, notificationManager);
let messageStore = createMessageStore(MESSAGES_DIR, notificationManager);
let instanceTracker = createInstanceTracker();

// Function to set push notification sender (called by server after initialization)
export function setPushNotificationSender(sender) {
  if (notificationManager && notificationManager.setPushNotificationSender) {
    notificationManager.setPushNotificationSender(sender);
  }
}

// Store reference to MCP server for sampling
let mcpServer = null;

export function setMcpServer(server) {
  mcpServer = server;
}


/**
 * Register a new agent
 */
export async function registerAgent(name, description, instanceId = null) {
  const startTime = Date.now();
  
  try {
    const result = await agentRegistry.registerAgent(name, description);
    
    // Track instance if provided
    if (instanceId) {
      await instanceTracker.trackInstance(instanceId, result.id, name);
    }
    
    const metadata = createMetadata(startTime, { 
      tool: 'register-agent',
      instanceTracked: !!instanceId 
    });
    
    return structuredResponse(
      result,
      `Agent '${name}' registered successfully with ID: ${result.id}${instanceId ? ' (instance tracked)' : ''}`,
      metadata
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Unregister an agent
 */
export async function unregisterAgent(id) {
  const startTime = Date.now();
  try {  
    const result = await agentRegistry.unregisterAgent(id);
    const metadata = createMetadata(startTime, { tool: 'unregister-agent' });
    
    const message = result.success 
      ? `Agent '${id}' unregistered successfully`
      : `Agent '${id}' not found`;
    
    return structuredResponse(result, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Discover all registered agents
 */
export async function discoverAgents() {
  const startTime = Date.now();
  
  try {
    const agents = await agentRegistry.discoverAgents();
    const metadata = createMetadata(startTime, { 
      tool: 'discover-agents',
      agentCount: agents.length 
    });
    
    let message;
    if (agents.length === 0) {
      message = 'No agents currently registered';
    } else {
      // Include agent details in the message
      const agentList = agents.map(agent => 
        `- ${agent.name} (ID: ${agent.id}): ${agent.description}`
      ).join('\n');
      message = `Found ${agents.length} registered agent${agents.length === 1 ? '' : 's'}:\n${agentList}`;
    }
    
    return structuredResponse({ agents }, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Send a message between agents
 */
export async function sendMessage(to, from, message) {
  const startTime = Date.now();
  
  try {
    // Verify both agents exist
    const fromAgent = await agentRegistry.getAgent(from);
    const toAgent = await agentRegistry.getAgent(to);
    
    if (!fromAgent) {
      throw Errors.resourceNotFound(`Sender agent not found: ${from}`);
    }
    if (!toAgent) {
      throw Errors.resourceNotFound(`Recipient agent not found: ${to}`);
    }
    
    const result = await messageStore.sendMessage(from, to, message);
    const metadata = createMetadata(startTime, { 
      tool: 'send-message',
      messageId: result.messageId 
    });
    
    return structuredResponse(
      { success: result.success },
      `Message sent successfully from ${fromAgent.name} to ${toAgent.name}`,
      metadata
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Check for messages for an agent
 */
export async function checkForMessages(agentId) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    // Get unread messages
    const messages = await messageStore.getMessagesForAgent(agentId, { unreadOnly: true });
    
    // Format messages for response before deletion, including sender names
    const formattedMessages = await Promise.all(messages.map(async msg => {
      // Try to get the sender's name
      const senderAgent = await agentRegistry.getAgent(msg.from);
      const senderName = senderAgent ? senderAgent.name : msg.from;
      
      return {
        from: msg.from,
        fromName: senderName,
        message: msg.message,
        timestamp: msg.timestamp
      };
    }));
    
    // Delete messages after successful processing
    for (const msg of messages) {
      await messageStore.deleteMessage(msg.id);
    }
    
    const metadata = createMetadata(startTime, { 
      tool: 'check-for-messages',
      messageCount: formattedMessages.length 
    });
    
    let message;
    if (formattedMessages.length === 0) {
      message = `No new messages for agent '${agent.name}'`;
    } else {
      // Include message details in the text response
      const messageList = formattedMessages.map((msg, index) => 
        `Message ${index + 1}:\n  From: ${msg.fromName} (${msg.from})\n  Content: ${msg.message}\n  Time: ${new Date(msg.timestamp).toLocaleString()}`
      ).join('\n\n');
      message = `Retrieved ${formattedMessages.length} new message${formattedMessages.length === 1 ? '' : 's'} for agent '${agent.name}':\n\n${messageList}`;
    }
    
    return structuredResponse({ messages: formattedMessages }, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Update agent status
 */
export async function updateAgentStatus(agentId, status) {
  const startTime = Date.now();
  
  try {
    // Update activity timestamp when changing status
    await agentRegistry.updateAgentActivity(agentId);
    
    const result = await agentRegistry.updateAgentStatus(agentId, status);
    const metadata = createMetadata(startTime, { 
      tool: 'update-agent-status',
      status 
    });
    
    const message = result.success 
      ? `Agent status updated from '${result.previousStatus}' to '${result.newStatus}'`
      : result.message || 'Failed to update agent status';
    
    return structuredResponse(result, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Subscribe to notifications
 */
export async function subscribeToNotifications(agentId, events) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    // For now, just acknowledge the subscription
    // In a real implementation, this would set up SSE or WebSocket connections
    const result = notificationManager.subscribe(agentId, events, (notification) => {
      // This callback would be invoked when notifications are emitted
      // In a real system, this would send the notification via SSE/WebSocket
    });
    
    const metadata = createMetadata(startTime, { 
      tool: 'subscribe-to-notifications',
      events 
    });
    
    return structuredResponse(
      result,
      `Agent '${agent.name}' subscribed to notifications: ${events.join(', ')}`,
      metadata
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Unsubscribe from notifications
 */
export async function unsubscribeFromNotifications(agentId, events = null) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    const result = notificationManager.unsubscribe(agentId, events);
    const metadata = createMetadata(startTime, { 
      tool: 'unsubscribe-from-notifications' 
    });
    
    const message = result.success
      ? events 
        ? `Agent '${agent.name}' unsubscribed from: ${events.join(', ')}`
        : `Agent '${agent.name}' unsubscribed from all notifications`
      : result.message || 'Failed to unsubscribe';
    
    return structuredResponse(result, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Send broadcast message
 */
export async function sendBroadcast(from, message, priority = 'normal') {
  const startTime = Date.now();
  
  try {
    // Verify sender exists
    const fromAgent = await agentRegistry.getAgent(from);
    if (!fromAgent) {
      throw Errors.resourceNotFound(`Sender agent not found: ${from}`);
    }
    
    // Pass agentRegistry to enable actual message delivery
    const result = await messageStore.sendBroadcast(from, message, priority, agentRegistry);
    const metadata = createMetadata(startTime, { 
      tool: 'send-broadcast',
      priority,
      recipientCount: result.recipientCount
    });
    
    // Check if broadcast was blocked
    if (!result.success && result.error) {
      // Return error response with all violation details
      return structuredResponse(
        result,
        result.error,
        metadata
      );
    }
    
    const statusMessage = result.recipientCount > 0
      ? `Broadcast sent from ${fromAgent.name} to ${result.recipientCount} agent${result.recipientCount === 1 ? '' : 's'} with ${priority} priority`
      : `Broadcast sent from ${fromAgent.name} with ${priority} priority (no recipients)`;
    
    return structuredResponse(
      result,
      statusMessage,
      metadata
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Get pending notifications
 */
export async function getPendingNotifications(agentId) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    const notifications = notificationManager.getPendingNotifications(agentId);
    const metadata = createMetadata(startTime, { 
      tool: 'get-pending-notifications',
      notificationCount: notifications.length 
    });
    
    let message;
    if (notifications.length > 0) {
      const notificationList = notifications.map((notif, index) => {
        const method = notif.method || 'unknown';
        const params = notif.params || {};
        let details = `${index + 1}. ${method}`;
        
        // Format based on notification type
        if (method === 'broadcast/message') {
          details += `\n   From: ${params.from || 'unknown'}\n   Message: ${params.message || 'no message'}\n   Priority: ${params.priority || 'normal'}`;
        } else if (method === 'message/delivered') {
          details += `\n   Message ID: ${params.messageId}\n   To: ${params.to}\n   From: ${params.from}`;
        } else if (method === 'agent/registered') {
          details += `\n   Agent: ${params.name} (${params.agentId})\n   Description: ${params.description}`;
        } else {
          details += '\n   ' + JSON.stringify(params, null, 2).replace(/\n/g, '\n   ');
        }
        
        return details;
      }).join('\n\n');
      
      message = `Retrieved ${notifications.length} pending notification${notifications.length === 1 ? '' : 's'} for agent '${agent.name}':\n\n${notificationList}`;
    } else {
      message = `No pending notifications for agent '${agent.name}'`;
    }
    
    return structuredResponse({ notifications }, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

/**
 * Unregister agent by instance ID
 */
export async function unregisterAgentByInstance(instanceId) {
  const startTime = Date.now();
  
  try {
    // Look up agent by instance
    const mapping = await instanceTracker.getAgentByInstance(instanceId);
    
    if (!mapping) {
      return structuredResponse(
        { success: false },
        `No agent found for instance: ${instanceId}`,
        createMetadata(startTime, { tool: 'unregister-agent-by-instance' })
      );
    }
    
    // Unregister the agent
    const result = await agentRegistry.unregisterAgent(mapping.agentId);
    
    // Remove instance tracking
    await instanceTracker.untrackInstance(instanceId);
    
    const metadata = createMetadata(startTime, { 
      tool: 'unregister-agent-by-instance',
      agentId: mapping.agentId,
      agentName: mapping.agentName
    });
    
    const message = result.success 
      ? `Agent '${mapping.agentName}' (${mapping.agentId}) unregistered successfully for instance ${instanceId}`
      : `Failed to unregister agent for instance ${instanceId}`;
    
    return structuredResponse(
      { ...result, agentId: mapping.agentId, agentName: mapping.agentName },
      message,
      metadata
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}


// Export for testing
export async function __resetForTesting() {
  // Clean up storage in test mode
  if (process.env.NODE_ENV === 'test') {
    try {
      const fs = await import('fs/promises');
      await fs.rm(STORAGE_DIR, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  }
  
  notificationManager = createNotificationManager();
  agentRegistry = createAgentRegistry(AGENTS_STORAGE, notificationManager);
  messageStore = createMessageStore(MESSAGES_DIR, notificationManager);
  instanceTracker = createInstanceTracker();
}

// Alias for backward compatibility
export const resetInstances = __resetForTesting;

/**
 * AI-powered agent assistant using MCP sampling
 */
export async function agentAiAssist(agentId, context, requestType) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    // Check if server supports sampling
    if (!mcpServer || !mcpServer.request) {
      throw Errors.internalError('MCP server not available or sampling not supported');
    }
    
    // Prepare prompts based on request type
    const prompts = {
      response: `You are ${agent.name}, an agent with the role: ${agent.description}. Another agent or user said: "${context}". Craft a helpful, contextual response that aligns with your role. Be concise but informative.`,
      
      status: `You are ${agent.name}, an agent that ${agent.description}. You just: ${context}. Create a brief, creative status message (max 100 chars) that captures what you're doing. Be creative and use emojis if appropriate.`,
      
      decision: `You are ${agent.name}, an agent with the role: ${agent.description}. Should you take action based on: ${context}? Respond with YES or NO followed by a brief explanation (1-2 sentences).`,
      
      analysis: `You are ${agent.name}, an agent with the role: ${agent.description}. Analyze this situation: ${context}. Provide a concise analysis (2-3 sentences) focusing on key insights relevant to your role.`
    };
    
    // Request AI assistance via sampling
    const samplingResponse = await mcpServer.request({
      method: 'sampling/createMessage',
      params: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompts[requestType]
            }
          }
        ],
        includeContext: 'none',
        maxTokens: requestType === 'status' ? 50 : (requestType === 'decision' ? 100 : 200),
        temperature: requestType === 'status' ? 0.9 : 0.7,
        modelPreferences: {
          costPriority: 0.2,
          speedPriority: 0.3,
          intelligencePriority: 0.9  // Prioritize intelligence for better agent responses
        }
      }
    });
    
    // Extract content from response
    const aiContent = samplingResponse.content?.text || samplingResponse.content || 'Unable to generate response';
    
    // For decisions, parse YES/NO and reasoning
    let result;
    if (requestType === 'decision') {
      const isYes = aiContent.toUpperCase().startsWith('YES');
      const reasoning = aiContent.replace(/^(YES|NO)\s*/i, '').trim();
      result = {
        type: requestType,
        content: isYes ? 'YES' : 'NO',
        reasoning
      };
    } else {
      result = {
        type: requestType,
        content: aiContent.trim()
      };
    }
    
    const metadata = createMetadata(startTime, { 
      tool: 'agent-ai-assist',
      requestType,
      model: samplingResponse.model || 'unknown'
    });
    
    const message = `AI assistance provided for ${agent.name} (${requestType} request)`;
    
    return structuredResponse(result, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(`AI assist failed: ${error.message}`);
  }
}

/**
 * Send broadcast with AI-enhanced capabilities
 */
export async function intelligentBroadcast(from, message, autoPriority = true, enhanceMessage = false) {
  const startTime = Date.now();
  
  try {
    // Verify sender exists
    const fromAgent = await agentRegistry.getAgent(from);
    if (!fromAgent) {
      throw Errors.resourceNotFound(`Sender agent not found: ${from}`);
    }
    
    let finalMessage = message;
    let determinedPriority = 'normal';
    let aiReasoning = '';
    
    // Use AI to analyze and potentially enhance the broadcast
    if ((autoPriority || enhanceMessage) && mcpServer && mcpServer.request) {
      try {
        const analysisPrompt = `Analyze this broadcast message from ${fromAgent.name} (${fromAgent.description}):

"${message}"

${autoPriority ? 'Determine the appropriate priority level (low, normal, or high) based on urgency and importance.' : ''}
${enhanceMessage ? 'If needed, suggest a clearer version of the message (keep it concise).' : ''}

Respond in JSON format:
{
  "priority": "${autoPriority ? 'low|normal|high' : 'normal'}",
  "enhanced_message": "${enhanceMessage ? 'enhanced version or null if no enhancement needed' : 'null'}",
  "reasoning": "brief explanation"
}`;

        const samplingResponse = await mcpServer.request({
          method: 'sampling/createMessage',
          params: {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: analysisPrompt
                }
              }
            ],
            includeContext: 'none',
            maxTokens: 200,
            temperature: 0.3
          }
        });
        
        // Parse AI response
        try {
          const aiAnalysis = JSON.parse(samplingResponse.content?.text || '{}');
          
          if (autoPriority && aiAnalysis.priority) {
            determinedPriority = aiAnalysis.priority;
          }
          
          if (enhanceMessage && aiAnalysis.enhanced_message) {
            finalMessage = aiAnalysis.enhanced_message;
          }
          
          aiReasoning = aiAnalysis.reasoning || 'AI analysis completed';
        } catch (parseError) {
          // If JSON parsing fails, try to extract priority from text
          const responseText = samplingResponse.content?.text || '';
          if (autoPriority) {
            if (responseText.toLowerCase().includes('high')) determinedPriority = 'high';
            else if (responseText.toLowerCase().includes('low')) determinedPriority = 'low';
          }
          aiReasoning = 'AI provided analysis';
        }
      } catch (aiError) {
        // If AI fails, fall back to defaults
        aiReasoning = `AI analysis unavailable: ${aiError.message}`;
      }
    }
    
    // Send the broadcast with determined parameters
    const result = await messageStore.sendBroadcast(from, finalMessage, determinedPriority, agentRegistry);
    
    const metadata = createMetadata(startTime, { 
      tool: 'intelligent-broadcast',
      priority: determinedPriority,
      recipientCount: result.recipientCount,
      aiEnhanced: autoPriority || enhanceMessage
    });
    
    // Prepare response
    const enhancedResult = {
      ...result,
      final_message: finalMessage,
      priority_used: determinedPriority,
      ai_reasoning: aiReasoning
    };
    
    const statusMessage = result.recipientCount > 0
      ? `Intelligent broadcast sent from ${fromAgent.name} to ${result.recipientCount} agent${result.recipientCount === 1 ? '' : 's'} with ${determinedPriority} priority${message !== finalMessage ? ' (message enhanced by AI)' : ''}`
      : `Intelligent broadcast sent from ${fromAgent.name} with ${determinedPriority} priority (no recipients)`;
    
    return structuredResponse(enhancedResult, statusMessage, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(`Intelligent broadcast failed: ${error.message}`);
  }
}
