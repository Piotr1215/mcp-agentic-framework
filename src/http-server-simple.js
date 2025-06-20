import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { HttpServerTransport } from './http-transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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

// Create MCP server with custom transport
const transport = new HttpServerTransport();
const mcpServer = new Server(
  {
    name: 'mcp-agentic-framework',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {
        listChanged: false
      },
    },
  }
);

// Connect transport
mcpServer.connect(transport);

// Define available tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.internalError(error.message);
  }
});

// Session storage
const sessions = new Map();

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const message = req.body;
    
    // Log for debugging
    console.log('Received message:', JSON.stringify(message, null, 2));

    // Process the message through MCP server
    const response = await transport.processMessage(message);
    
    // Handle session management for initialize
    if (message.method === 'initialize' && response.result) {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessions.set(sessionId, {
        createdAt: new Date().toISOString(),
        clientInfo: message.params?.clientInfo
      });
      res.setHeader('Mcp-Session-Id', sessionId);
    }
    
    // Check for session ID on non-initialize requests
    const sessionId = req.headers['mcp-session-id'];
    if (message.method !== 'initialize' && message.id && sessionId && !sessions.has(sessionId)) {
      return res.status(404).json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32001,
          message: 'Session not found'
        }
      });
    }

    // Send response
    if (message.id) {
      // It's a request, send the response
      res.json(response);
    } else {
      // It's a notification, send 202 Accepted
      res.status(202).send();
    }
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', name: 'mcp-agentic-framework', version: '1.0.0' });
});

// Start server
app.listen(port, '127.0.0.1', () => {
  console.log(`MCP Agentic Framework HTTP server listening at http://127.0.0.1:${port}/mcp`);
  console.log(`Health check available at http://127.0.0.1:${port}/health`);
});

export default app;