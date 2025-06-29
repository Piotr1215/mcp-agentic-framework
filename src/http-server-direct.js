import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { toolDefinitions } from './toolDefinitions.js';
import { 
  registerAgent, 
  unregisterAgent, 
  discoverAgents, 
  sendMessage, 
  checkForMessages,
  updateAgentStatus,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  sendBroadcast,
  getPendingNotifications
} from './tools.js';
import { Errors, MCPError } from './errors.js';

// Increase max listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

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
            tools: {}
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
        cleanup: '/monitor/cleanup'
      }
    }
  });
});

// Start server
app.listen(port, '127.0.0.1', () => {
  console.log(`MCP Agentic Framework HTTP server listening at http://127.0.0.1:${port}`);
  console.log(`MCP endpoint: http://127.0.0.1:${port}/mcp`);
  console.log(`Health check: http://127.0.0.1:${port}/health`);
});

export default app;