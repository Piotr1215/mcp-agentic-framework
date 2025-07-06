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
import { Errors, MCPError } from './errors.js';
import { handleCompletion } from './completionHandler.js';

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
const sseConnections = new Map(); // SSE connections by session

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
      const { agentAiAssist } = await import('./tools.js');
      
      // Check if session has SSE connection
      const sessionId = args._sessionId;
      const sseConnection = sseConnections.get(sessionId);
      
      // Pass SSE connection to the function via global
      if (sseConnection && sseConnection.connected) {
        global.currentSseConnection = sseConnection;
        global.currentSessionId = sessionId;
      }
      
      try {
        return await agentAiAssist(agent_id, context, request_type);
      } finally {
        // Clean up globals
        delete global.currentSseConnection;
        delete global.currentSessionId;
      }
    }

    default:
      throw Errors.toolNotFound(name);
  }
}

// SSE endpoint - handle GET requests to the main MCP endpoint
app.get('/mcp', async (req, res) => {
  const sessionId = req.query.sessionId || req.headers['mcp-session-id'] || `sse-${Date.now()}`;
  
  console.log(`SSE connection request for session: ${sessionId}`);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });
  
  // Create SSE connection object
  const sseConnection = {
    res,
    sessionId,
    connected: true,
    send: (data) => {
      if (!sseConnection.connected) return;
      
      // Format as SSE message
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    sendSamplingRequest: (requestId, prompt, params = {}) => {
      const message = {
        jsonrpc: '2.0',
        id: requestId,
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
          ...params
        }
      };
      
      console.log(`Sending sampling request ${requestId} over SSE`);
      sseConnection.send(message);
    }
  };
  
  // Store connection
  sseConnections.set(sessionId, sseConnection);
  
  // Send initial connection message
  sseConnection.send({
    type: 'connection',
    status: 'connected',
    sessionId,
    message: 'SSE connection established. Sampling support enabled.'
  });
  
  // Keep connection alive with periodic pings
  const pingInterval = setInterval(() => {
    if (!sseConnection.connected) {
      clearInterval(pingInterval);
      return;
    }
    res.write(':ping\n\n');
  }, 30000);
  
  // Handle client disconnect
  const handleClose = () => {
    console.log(`SSE connection closed for session: ${sessionId}`);
    sseConnection.connected = false;
    sseConnections.delete(sessionId);
    clearInterval(pingInterval);
    // Clean up the listener
    req.removeListener('close', handleClose);
  };
  req.on('close', handleClose);
});

// Endpoint to receive sampling responses from client
app.post('/sampling/response', async (req, res) => {
  try {
    const { sessionId, requestId, result, error } = req.body;
    
    console.log(`Received sampling response for request ${requestId}`);
    
    // Find pending sampling request
    const pendingRequest = global.pendingSamplingRequests?.get(requestId);
    if (pendingRequest) {
      if (error) {
        pendingRequest.reject(new Error(error.message || 'Sampling failed'));
      } else {
        pendingRequest.resolve(result);
      }
      global.pendingSamplingRequests.delete(requestId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling sampling response:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const message = req.body;
    const sessionId = req.headers['mcp-session-id'] || req.headers['x-session-id'];
    
    // Log for debugging
    console.log('Received message:', JSON.stringify(message, null, 2));
    console.log('Session ID:', sessionId);
    
    // Handle error responses to sampling requests
    if (message.error && message.id && typeof message.id === 'string' && message.id.startsWith('sampling-')) {
      console.log('Received error response for sampling request:', message.error);
      
      // Find pending sampling request
      const pendingRequest = global.pendingSamplingRequests?.get(message.id);
      if (pendingRequest) {
        pendingRequest.reject(new Error(message.error.message || 'Sampling failed'));
        global.pendingSamplingRequests.delete(message.id);
      }
      
      res.json({ success: true });
      return;
    }
    
    // Handle different message types
    if (message.method === 'initialize') {
      const requestedVersion = message.params?.protocolVersion || '2025-06-18';
      const newSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessions.set(newSessionId, {
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
            sampling: {}, // Sampling is supported via SSE
            completions: {}
          },
          serverInfo: {
            name: 'mcp-agentic-framework',
            version: '1.0.0'
          }
        }
      };
      
      res.setHeader('Mcp-Session-Id', newSessionId);
      res.setHeader('MCP-Protocol-Version', '2025-06-18');
      res.json(response);
      console.log('Sent initialize response with session:', newSessionId);
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
      
      // Pass session ID to tool handler
      const enhancedArgs = { ...args, _sessionId: sessionId };
      
      try {
        const result = await handleToolCall(name, enhancedArgs);
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

    // Handle sampling/createMessage - this should not come via HTTP POST
    if (message.method === 'sampling/createMessage') {
      console.log('Received sampling request via HTTP POST - should use SSE');
      
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Sampling requests should be initiated by server via SSE, not by client via HTTP POST',
          data: {
            hint: 'Connect to SSE endpoint at /sse to receive sampling requests'
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
    console.error('Instance deregistration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SSE status endpoint
app.get('/sse-status', (req, res) => {
  const connections = Array.from(sseConnections.entries()).map(([id, conn]) => ({
    sessionId: id,
    connected: conn.connected
  }));
  
  res.json({
    sseSupport: true,
    activeConnections: connections.filter(c => c.connected).length,
    connections
  });
});

// Initialize global storage for pending sampling requests
global.pendingSamplingRequests = new Map();

// Start server
app.listen(port, () => {
  console.log(`
🚀 MCP HTTP+SSE Server running on port ${port}
   
   Endpoints:
   - POST /mcp - Standard MCP operations
   - GET  /mcp - SSE stream for sampling (same endpoint!)
   - POST /sampling/response - Client sends AI results back
   
   Features:
   ✅ HTTP endpoints for standard MCP operations
   ✅ SSE support for server-initiated sampling
   ✅ Real AI sampling support (client must connect via GET)
   ✅ Prompt completions
   ✅ MCP specification compliant
   
   To enable sampling:
   1. Client POSTs to /mcp for normal operations
   2. Client GETs /mcp to establish SSE connection
   3. Server sends sampling requests via SSE
   4. Client responds via POST to /sampling/response
  `);
});