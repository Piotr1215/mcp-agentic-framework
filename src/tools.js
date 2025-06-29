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
        `- ${agent.name} (ID: ${agent.id})\n  Status: ${agent.status || 'No status set'}\n  Description: ${agent.description}`
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
 * Agent AI Assist - Get intelligent AI assistance
 */
export async function agentAiAssist(agentId, context, requestType) {
  const startTime = Date.now();
  
  try {
    // Verify agent exists
    const agent = await agentRegistry.getAgent(agentId);
    if (!agent) {
      throw Errors.resourceNotFound(`Agent not found: ${agentId}`);
    }
    
    // Prepare prompt based on request type
    let prompt;
    const agentContext = `You are helping agent "${agent.name}" (${agent.id}) - ${agent.description}`;
    
    switch (requestType) {
      case 'response':
        prompt = `${agentContext}\n\nThe agent needs help crafting a response to this situation:\n${context}\n\nProvide a thoughtful, contextually appropriate response the agent could send.`;
        break;
        
      case 'status':
        prompt = `${agentContext}\n\nThe agent needs a creative status update based on:\n${context}\n\nGenerate a short, engaging status message (max 100 chars) that reflects the agent's current activity.`;
        break;
        
      case 'decision':
        prompt = `${agentContext}\n\nThe agent needs help making a decision:\n${context}\n\nAnalyze the situation and provide a clear yes/no recommendation with brief reasoning.`;
        break;
        
      case 'analysis':
        prompt = `${agentContext}\n\nThe agent needs help analyzing this situation:\n${context}\n\nProvide a concise analysis highlighting key insights and suggested actions.`;
        break;
        
      default:
        throw Errors.invalidParams(`Unknown request type: ${requestType}`);
    }
    
    // Check for SSE connection first (for HTTP+SSE mode)
    const sseConnection = global.currentSseConnection;
    const sessionId = global.currentSessionId;
    
    if (sseConnection && sseConnection.connected) {
      // Use SSE for real AI sampling
      return new Promise((resolve, reject) => {
        const requestId = `sampling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize pending requests map if not exists
        if (!global.pendingSamplingRequests) {
          global.pendingSamplingRequests = new Map();
        }
        
        // Set up timeout
        const timeout = setTimeout(() => {
          global.pendingSamplingRequests.delete(requestId);
          reject(Errors.internalError('Sampling request timeout (30s)'));
        }, 30000);
        
        // Store pending request
        global.pendingSamplingRequests.set(requestId, {
          resolve: (result) => {
            clearTimeout(timeout);
            const aiResponse = result.content?.text || result.content || 'Unable to generate AI response';
            
            const metadata = createMetadata(startTime, { 
              tool: 'agent-ai-assist',
              requestType,
              samplingUsed: true,
              transportType: 'sse'
            });
            
            resolve(structuredResponse(
              { 
                success: true, 
                aiResponse,
                requestType 
              },
              `AI assistance provided for ${requestType} request`,
              metadata
            ));
          },
          reject: (error) => {
            clearTimeout(timeout);
            
            // If client doesn't support sampling via SSE, fall back to guidance
            if (error.message && error.message.includes('Method not found')) {
              const instructions = generateAiInstructions(requestType, context, agent);
              
              const metadata = createMetadata(startTime, { 
                tool: 'agent-ai-assist',
                requestType,
                fallbackMode: true,
                fallbackReason: 'Client does not support SSE sampling'
              });
              
              resolve(structuredResponse(
                { 
                  success: true, 
                  aiGuidance: instructions,
                  requiresManualExecution: true 
                },
                `AI assistance instructions generated for ${requestType}. Client does not support SSE sampling.`,
                metadata
              ));
            } else {
              reject(error);
            }
          }
        });
        
        // Send sampling request over SSE
        const samplingParams = {
          modelPreferences: {
            hints: [
              {
                name: 'claude-3-haiku-20240307'
              }
            ],
            intelligenceLevel: 0.5,
            speedLevel: 0.9
          },
          systemPrompt: 'You are an AI assistant helping autonomous agents make intelligent decisions and craft appropriate responses. Be concise and practical.',
          maxTokens: requestType === 'status' ? 50 : 500
        };
        
        sseConnection.sendSamplingRequest(requestId, prompt, samplingParams);
        
        console.log(`Sent sampling request ${requestId} over SSE`);
      });
    }
    
    // Check if MCP server supports sampling (stdio mode)
    if (!mcpServer || !mcpServer.request) {
      // Fallback to instruction-based approach
      const instructions = generateAiInstructions(requestType, context, agent);
      
      const metadata = createMetadata(startTime, { 
        tool: 'agent-ai-assist',
        requestType,
        fallbackMode: true
      });
      
      return structuredResponse(
        { 
          success: true, 
          aiGuidance: instructions,
          requiresManualExecution: true 
        },
        `AI assistance instructions generated for ${requestType}. Please follow the guidance provided.`,
        metadata
      );
    }
    
    // Use MCP sampling to get AI assistance
    const response = await mcpServer.request({
      method: 'sampling/createMessage',
      params: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt
            }
          }
        ],
        modelPreferences: {
          hints: [
            {
              name: 'claude-3-haiku-20240307'
            }
          ],
          intelligenceLevel: 0.5,
          speedLevel: 0.9
        },
        systemPrompt: 'You are an AI assistant helping autonomous agents make intelligent decisions and craft appropriate responses. Be concise and practical.',
        maxTokens: requestType === 'status' ? 50 : 500
      }
    });
    
    const aiResponse = response.content?.text || 'Unable to generate AI response';
    
    const metadata = createMetadata(startTime, { 
      tool: 'agent-ai-assist',
      requestType,
      samplingUsed: true
    });
    
    return structuredResponse(
      { 
        success: true, 
        aiResponse,
        requestType 
      },
      `AI assistance provided for ${requestType} request`,
      metadata
    );
    
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}

// Helper function for fallback mode
function generateAiInstructions(requestType, context, agent) {
  const baseInstructions = {
    response: {
      title: 'Crafting an Intelligent Response',
      steps: [
        '1. Read the context carefully to understand the situation',
        '2. Consider the agent\'s role and capabilities',
        '3. Draft a response that is:',
        '   - Relevant to the context',
        '   - Consistent with the agent\'s purpose',
        '   - Clear and actionable',
        '4. Keep the response concise but informative'
      ],
      example: 'Example: If asked about data analysis, mention specific capabilities and offer concrete next steps.'
    },
    status: {
      title: 'Creating a Status Update',
      steps: [
        '1. Summarize current activity in 2-5 words',
        '2. Make it descriptive and engaging',
        '3. Keep under 100 characters',
        '4. Reflect the agent\'s current focus'
      ],
      example: 'Examples: "analyzing patterns", "compiling reports", "awaiting input", "processing requests"'
    },
    decision: {
      title: 'Making an Informed Decision',
      steps: [
        '1. List pros and cons based on context',
        '2. Consider the agent\'s goals and constraints',
        '3. Make a clear yes/no choice',
        '4. Provide 1-2 sentences of reasoning'
      ],
      example: 'Example: "Yes, proceed with the analysis. The data is sufficient and aligns with our objectives."'
    },
    analysis: {
      title: 'Analyzing the Situation',
      steps: [
        '1. Identify key elements in the context',
        '2. Note patterns or important relationships',
        '3. Highlight 2-3 main insights',
        '4. Suggest 1-2 actionable next steps'
      ],
      example: 'Example: Identify bottlenecks, opportunities, and risks, then propose specific actions.'
    }
  };
  
  const instructions = baseInstructions[requestType];
  
  return {
    title: instructions.title,
    context: `Agent: ${agent.name} - ${agent.description}`,
    situation: context,
    guidelines: instructions.steps,
    example: instructions.example,
    note: 'Since MCP sampling is not available, please use these guidelines to manually craft your response.'
  };
}
