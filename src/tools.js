import { createAgentRegistry } from './lib/agentRegistry.js';
import { createMessageStore } from './lib/messageStore.js';
import { Errors, MCPError } from './errors.js';
import { textResponse, structuredResponse, createMetadata } from './response-formatter.js';
import * as path from 'path';

// Initialize storage paths
const STORAGE_DIR = process.env.NODE_ENV === 'test' 
  ? `/tmp/mcp-agentic-framework-test-${process.pid}-${Date.now()}`
  : '/tmp/mcp-agentic-framework';
const AGENTS_STORAGE = path.join(STORAGE_DIR, 'agents.json');
const MESSAGES_DIR = path.join(STORAGE_DIR, 'messages');

// Create instances - these will be reset in tests
let agentRegistry = createAgentRegistry(AGENTS_STORAGE);
let messageStore = createMessageStore(MESSAGES_DIR);

// Function to reset instances (for testing)
export function resetInstances() {
  // Use unique paths for each reset in test mode
  if (process.env.NODE_ENV === 'test') {
    const testDir = `/tmp/mcp-agentic-framework-test-${process.pid}-${Date.now()}`;
    agentRegistry = createAgentRegistry(path.join(testDir, 'agents.json'));
    messageStore = createMessageStore(path.join(testDir, 'messages'));
  } else {
    agentRegistry = createAgentRegistry(AGENTS_STORAGE);
    messageStore = createMessageStore(MESSAGES_DIR);
  }
}

/**
 * Register a new agent
 */
export async function registerAgent(name, description) {
  const startTime = Date.now();
  
  try {
    const result = await agentRegistry.registerAgent(name, description);
    const metadata = createMetadata(startTime, { tool: 'register-agent' });
    
    return structuredResponse(
      result,
      `Agent '${name}' registered successfully with ID: ${result.id}`,
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
    
    return structuredResponse(agents, message, metadata);
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
    
    // Format messages for response before deletion
    const formattedMessages = messages.map(msg => ({
      from: msg.from,
      message: msg.message,
      timestamp: msg.timestamp
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
        `Message ${index + 1}:\n  From: ${msg.from}\n  Content: ${msg.message}\n  Time: ${new Date(msg.timestamp).toLocaleString()}`
      ).join('\n\n');
      message = `Retrieved ${formattedMessages.length} new message${formattedMessages.length === 1 ? '' : 's'} for agent '${agent.name}':\n\n${messageList}`;
    }
    
    return structuredResponse(formattedMessages, message, metadata);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
}