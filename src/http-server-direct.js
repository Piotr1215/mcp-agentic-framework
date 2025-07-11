import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { toolDefinitions } from './toolDefinitions.js';
import { resourceDefinitions, getResourceContent } from './resourceDefinitions.js';
import { promptDefinitions, getPromptContent } from './promptDefinitions.js';
import { 
  registerAgent, 
  unregisterAgent, 
  discoverAgents, 
  sendMessage, 
  checkForMessages,
  updateAgentStatus,
  sendBroadcast,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getPendingNotifications
} from './tools.js';
import { createAgentRegistry } from './lib/agentRegistry.js';
import { Errors, MCPError } from './errors.js';

// Increase max listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

// Get agent registry instance
const agentRegistry = createAgentRegistry();

const app = express();
const port = process.env.PORT || 3113;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Session storage
const sessions = new Map();

// Helper to handle tool calls
async function handleToolCall(name, args) {
  switch (name) {
    case 'register-agent': {
      const { name: agentName, description } = args;
      return await registerAgent(agentName, description);
    }

    case 'unregister-agent': {
      const { id } = args;
      return await unregisterAgent(id);
    }

    case 'discover-agents': {
      return await discoverAgents();
    }

    case 'send-message': {
      const { to, from, message } = args;
      return await sendMessage(to, from, message);
    }

    case 'check-for-messages': {
      const { agent_id } = args;
      return await checkForMessages(agent_id);
    }

    case 'update-agent-status': {
      const { agent_id, status } = args;
      return await updateAgentStatus(agent_id, status);
    }

    case 'subscribe-to-notifications': {
      const { agent_id, events } = args;
      return await subscribeToNotifications(agent_id, events);
    }

    case 'unsubscribe-from-notifications': {
      const { agent_id, events } = args;
      return await unsubscribeFromNotifications(agent_id, events);
    }

    case 'send-broadcast': {
      const { from, message, priority } = args;
      return await sendBroadcast(from, message, priority);
    }

    case 'get-pending-notifications': {
      const { agent_id } = args;
      return await getPendingNotifications(agent_id);
    }

    case 'agent-ai-assist': {
      const { agent_id, context, request_type } = args;
      // Import agentAiAssist dynamically to avoid circular dependencies
      const { agentAiAssist } = await import('./tools.js');
      return await agentAiAssist(agent_id, context, request_type);
    }

    default:
      throw Errors.toolNotFound(name);
  }
}

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const message = req.body;
    
    // Log for debugging
    console.log('Received message:', JSON.stringify(message, null, 2));
    console.log('Headers:', req.headers);

    // Check for protocol version in subsequent requests
    const protocolVersion = req.headers['mcp-protocol-version'];
    
    // Handle different message types
    if (message.method === 'initialize') {
      const requestedVersion = message.params?.protocolVersion || '2025-06-18';
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessions.set(sessionId, {
        createdAt: new Date().toISOString(),
        clientInfo: message.params?.clientInfo,
        protocolVersion: requestedVersion
      });
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            sampling: {},
            completions: {}
          },
          serverInfo: {
            name: 'mcp-agentic-framework',
            version: '1.0.0'
          }
        }
      };
      
      res.setHeader('Mcp-Session-Id', sessionId);
      res.setHeader('MCP-Protocol-Version', '2025-06-18');
      res.json(response);
      console.log('Sent initialize response with session:', sessionId);
      return;
    }

    // Handle tools/list
    if (message.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: toolDefinitions,
          _meta: {
            toolsCount: toolDefinitions.length
          }
        }
      };
      res.setHeader('MCP-Protocol-Version', '2025-06-18');
      res.json(response);
      console.log('Sent tools list');
      return;
    }

    // Handle resources/list
    if (message.method === 'resources/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          resources: resourceDefinitions
        }
      };
      res.setHeader('MCP-Protocol-Version', '2025-06-18');
      res.json(response);
      console.log('Sent resources list');
      return;
    }

    // Handle resources/read
    if (message.method === 'resources/read') {
      const { uri } = message.params;
      console.log('Reading resource:', uri);
      
      try {
        const content = await getResourceContent(uri);
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            contents: [content]
          }
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json(response);
        console.log('Sent resource content');
        return;
      } catch (error) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32602,
            message: `Resource not found: ${uri}`
          }
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.status(404).json(errorResponse);
        return;
      }
    }

    // Handle prompts/list
    if (message.method === 'prompts/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          prompts: promptDefinitions
        }
      };
      res.setHeader('MCP-Protocol-Version', '2025-06-18');
      res.json(response);
      console.log('Sent prompts list');
      return;
    }

    // Handle prompts/get
    if (message.method === 'prompts/get') {
      const { name, arguments: args = {} } = message.params;
      console.log('Getting prompt:', name, 'with args:', args);
      
      try {
        const prompt = promptDefinitions.find(p => p.name === name);
        if (!prompt) {
          throw new Error(`Prompt not found: ${name}`);
        }
        
        const content = await getPromptContent(name, args);
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            description: prompt.description,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: content
                }
              }
            ]
          }
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json(response);
        console.log('Sent prompt content');
        return;
      } catch (error) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32602,
            message: error.message
          }
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.status(404).json(errorResponse);
        return;
      }
    }

    // Handle tool calls
    if (message.method === 'tools/call') {
      const { name, arguments: args } = message.params;
      console.log('Calling tool:', name, 'with args:', args);
      
      try {
        const result = await handleToolCall(name, args);
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json(response);
        console.log('Tool call successful:', name);
      } catch (error) {
        console.error('Tool call error:', error);
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: error.code || -32603,
            message: error.message || 'Internal error',
            data: error.data
          }
        });
      }
      return;
    }

    // Handle completions
    if (message.method === 'completion/complete') {
      const { ref, argument } = message.params;
      console.log('Handling completion for:', ref.type, ref.name, argument.name);
      
      try {
        // Import completion logic
        const { handleCompletion } = await import('./completionHandler.js');
        const result = await handleCompletion(ref, argument);
        
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result
        };
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json(response);
        console.log('Completion handled successfully');
      } catch (error) {
        console.error('Completion error:', error);
        res.setHeader('MCP-Protocol-Version', '2025-06-18');
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          }
        });
      }
      return;
    }

    // Handle sampling/createMessage - proxy request back to client
    if (message.method === 'sampling/createMessage') {
      console.log('Received sampling request - HTTP transport cannot forward to client');
      
      // HTTP transport limitation: we cannot initiate requests to the client
      // Return an error indicating this limitation
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Sampling not supported over HTTP transport. The server cannot initiate requests to the client. Use stdio transport or the fallback mode will be activated.',
          data: {
            transportType: 'http',
            fallbackAvailable: true
          }
        }
      });
      return;
    }

    // Handle notifications (no response needed)
    if (!message.id) {
      console.log('Received notification:', message.method);
      res.status(202).send();
      return;
    }

    // Unknown method
    res.json({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`
      }
    });

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data
      }
    });
  }
});

// Instance management endpoints
app.delete('/instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    console.log(`Deregistering agent for instance: ${instanceId}`);
    
    // Import the function we need
    const { unregisterAgentByInstance } = await import('./tools.js');
    
    const result = await unregisterAgentByInstance(instanceId);
    
    if (result.structuredContent.success) {
      res.json({
        success: true,
        message: result.content[0].text,
        agentId: result.structuredContent.agentId,
        agentName: result.structuredContent.agentName
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.content[0].text
      });
    }
  } catch (error) {
    console.error('Error deregistering by instance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    // Import the instance tracker
    const { createInstanceTracker } = await import('./lib/instanceTracker.js');
    const instanceTracker = createInstanceTracker();
    
    const mapping = await instanceTracker.getAgentByInstance(instanceId);
    
    if (mapping) {
      res.json({
        success: true,
        ...mapping
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No agent found for instance: ${instanceId}`
      });
    }
  } catch (error) {
    console.error('Error getting instance mapping:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', name: 'mcp-agentic-framework', version: '1.0.0' });
});

// Monitor endpoint - get all messages without deleting them
app.get('/monitor/messages', async (req, res) => {
  try {
    const { createMessageStore } = await import('./lib/messageStore.js');
    const messageStore = createMessageStore('/tmp/mcp-agentic-framework/messages');
    const messages = await messageStore.getAllMessages();
    res.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching messages for monitor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Monitor endpoint - get all agents data
app.get('/monitor/agents', async (req, res) => {
  try {
    // Set CORS headers for monitor endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    const fs = await import('fs/promises');
    const path = await import('path');
    const agentsPath = path.join('/tmp/mcp-agentic-framework', 'agents.json');
    
    try {
      const data = await fs.readFile(agentsPath, 'utf8');
      const agents = JSON.parse(data);
      res.json({
        success: true,
        agents,
        count: Object.keys(agents).length
      });
    } catch (error) {
      // File doesn't exist yet
      res.json({
        success: true,
        agents: {},
        count: 0
      });
    }
  } catch (error) {
    console.error('Error fetching agents for monitor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Monitor endpoint - get workflow definitions
app.get('/monitor/workflows', async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    const fs = await import('fs/promises');
    const path = await import('path');
    const workflowsPath = path.join(process.env.HOME, 'claude-workflows', 'workflows.json');
    
    try {
      const data = await fs.readFile(workflowsPath, 'utf8');
      const workflowData = JSON.parse(data);
      res.json({
        success: true,
        workflows: workflowData.workflows
      });
    } catch (error) {
      // File doesn't exist, return defaults
      res.json({
        success: true,
        workflows: {
          'code review': {
            id: 'code-review',
            title: 'Code Review Process',
            icon: '📋',
            steps: ['Check tests', 'Review code', 'Leave feedback']
          }
        }
      });
    }
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// External broadcast endpoint
app.post('/external/broadcast', async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    // Check API key authentication
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.MCP_EXTERNAL_API_KEY || 'test-key-123';
    
    if (apiKey !== expectedKey) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API key'
      });
      return;
    }
    
    // Extract broadcast parameters
    const { from, message, priority = 'normal' } = req.body;
    
    if (!from || !message) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: from, message'
      });
      return;
    }
    
    // For external broadcasts, we use the 'from' field directly without creating agents
    // This prevents agent proliferation and keeps external systems separate
    console.log(`External broadcast from: ${from}`);
    
    // Use a simplified broadcast mechanism for external systems
    const { createMessageStore } = await import('./lib/messageStore.js');
    const messageStore = createMessageStore('/tmp/mcp-agentic-framework/messages');
    
    // Get all active agents to deliver the broadcast
    const agents = await discoverAgents();
    const activeAgents = agents.structuredContent?.agents || [];
    const recipientCount = activeAgents.length;
    
    // Format the broadcast message properly
    const broadcastMessage = `[BROADCAST ${(priority || 'normal').toUpperCase()}] Broadcast to: all\nFrom: ${from}\n${message}`;
    
    // Manually send to each agent without using the full broadcast mechanism
    for (const agent of activeAgents) {
      await messageStore.sendMessage(from, agent.id, broadcastMessage);
    }
    
    console.log(`External broadcast delivered to ${recipientCount} agents`);
    
    // Return the result
    res.json({
      success: true,
      result: {
        recipientCount: recipientCount,
        priority: priority || 'normal',
        message: `Broadcast sent from ${from} to ${recipientCount} agents with ${priority || 'normal'} priority`
      }
    });
    
  } catch (error) {
    console.error('External broadcast error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Monitor endpoint - update workflow definitions
app.put('/monitor/workflows', async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    const fs = await import('fs/promises');
    const path = await import('path');
    const workflowsPath = path.join(process.env.HOME, 'claude-workflows', 'workflows.json');
    
    const { workflows } = req.body;
    if (!workflows) {
      res.status(400).json({
        success: false,
        error: 'Missing workflows data'
      });
      return;
    }
    
    // Save the updated workflows
    await fs.writeFile(workflowsPath, JSON.stringify({ workflows }, null, 2));
    
    res.json({
      success: true,
      message: 'Workflows updated successfully'
    });
  } catch (error) {
    console.error('Error updating workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old messages endpoint
app.delete('/monitor/cleanup', async (req, res) => {
  try {
    const { olderThanHours = 24 } = req.query;
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    const { createMessageStore } = await import('./lib/messageStore.js');
    const messageStore = createMessageStore('/tmp/mcp-agentic-framework/messages');
    const messages = await messageStore.getAllMessages();
    
    let deletedCount = 0;
    for (const msg of messages) {
      if (new Date(msg.timestamp) < cutoffTime) {
        await messageStore.deleteMessage(msg.id);
        deletedCount++;
      }
    }
    
    res.json({
      success: true,
      deletedCount,
      totalMessages: messages.length,
      cutoffTime: cutoffTime.toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({ 
    message: 'MCP Agentic Framework HTTP Server',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      instance: {
        get: '/instance/:instanceId',
        delete: '/instance/:instanceId'
      },
      monitor: {
        messages: '/monitor/messages',
        cleanup: '/monitor/cleanup',
        agents: '/monitor/agents'
      }
    }
  });
});

// Only start server if this is the main module (not imported for tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`MCP Agentic Framework HTTP server listening at http://127.0.0.1:${port}`);
    console.log(`MCP endpoint: http://127.0.0.1:${port}/mcp`);
    console.log(`Health check: http://127.0.0.1:${port}/health`);
  });
}

export default app;