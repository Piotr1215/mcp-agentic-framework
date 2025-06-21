import express from 'express';
import cors from 'cors';
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

const app = express();
const port = process.env.PORT || 3113;

// Middleware
app.use(express.json());
app.use(cors());

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

    // Handle different message types
    if (message.method === 'initialize') {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessions.set(sessionId, {
        createdAt: new Date().toISOString(),
        clientInfo: message.params?.clientInfo
      });
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
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
          tools: toolDefinitions
        }
      };
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
        res.json(response);
        console.log('Tool call successful:', name);
      } catch (error) {
        console.error('Tool call error:', error);
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