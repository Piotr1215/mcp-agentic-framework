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
