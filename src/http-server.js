import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { Errors, MCPError } from './errors.js';

const app = express();
const port = process.env.PORT || 3113;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:*'],
  credentials: true
}));

// MCP server instance
const mcpServer = createServer();

// Store SSE connections by session
const sseConnections = new Map();
const sessions = new Map();

// Generate session ID
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Validate session
function validateSession(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  if (sessionId && !sessions.has(sessionId)) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Session not found'
      }
    });
    return null;
  }
  return sessionId;
}

// Main MCP endpoint - handles both POST and GET
app.all('/mcp', async (req, res) => {
  // Security: Validate Origin header
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32002,
        message: 'Origin not allowed'
      }
    });
  }

  // Handle GET requests for SSE
  if (req.method === 'GET') {
    const acceptHeader = req.headers.accept || '';
    if (!acceptHeader.includes('text/event-stream')) {
      return res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32003,
          message: 'GET requests must accept text/event-stream'
        }
      });
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    // Store connection
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId) {
      if (!sseConnections.has(sessionId)) {
        sseConnections.set(sessionId, []);
      }
      sseConnections.get(sessionId).push(res);

      // Handle client disconnect
      req.on('close', () => {
        const connections = sseConnections.get(sessionId);
        if (connections) {
          const index = connections.indexOf(res);
          if (index > -1) {
            connections.splice(index, 1);
          }
          if (connections.length === 0) {
            sseConnections.delete(sessionId);
          }
        }
      });
    }

    // Send initial ping
    res.write('event: ping\ndata: {}\n\n');

    return;
  }

  // Handle POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32004,
        message: 'Method not allowed'
      }
    });
  }

  const acceptHeader = req.headers.accept || '';
  if (!acceptHeader.includes('application/json') && !acceptHeader.includes('text/event-stream')) {
    return res.status(406).json({
      jsonrpc: '2.0',
      error: {
        code: -32005,
        message: 'Accept header must include application/json or text/event-stream'
      }
    });
  }

  try {
    const message = req.body;

    // Handle initialization
    if (message.method === 'initialize') {
      // Process through MCP server
      const response = await new Promise((resolve, reject) => {
        mcpServer._transport.send = resolve;
        mcpServer._transport.emit('message', message);
      });
      
      // Generate session ID
      const sessionId = generateSessionId();
      sessions.set(sessionId, {
        createdAt: new Date().toISOString(),
        clientInfo: message.params?.clientInfo
      });

      // Add session ID to response
      res.setHeader('Mcp-Session-Id', sessionId);
      res.json(response);
      return;
    }

    // Validate session for all other requests
    const sessionId = validateSession(req, res);
    if (sessionId === null && message.method !== 'initialize') {
      return; // Response already sent
    }

    // Handle notifications and responses
    if (!message.id) {
      // It's a notification or response
      mcpServer._transport.emit('message', message);
      res.status(202).send();
      return;
    }

    // Handle requests
    const response = await new Promise((resolve, reject) => {
      mcpServer._transport.send = resolve;
      mcpServer._transport.emit('message', message);
    });

    // Check if we should stream the response
    const shouldStream = acceptHeader.includes('text/event-stream') && 
                        sessionId && 
                        sseConnections.has(sessionId);

    if (shouldStream) {
      // Set up SSE response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Send the response via SSE
      res.write(`event: message\ndata: ${JSON.stringify(result)}\n\n`);
      res.end();
    } else {
      // Send regular JSON response
      res.json(result);
    }

  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data
      }
    };

    if (error instanceof MCPError) {
      errorResponse.error.code = error.code;
      errorResponse.error.data = error.data;
    }

    res.status(400).json(errorResponse);
  }
});

// DELETE endpoint for session termination
app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  
  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32006,
        message: 'Session ID required'
      }
    });
  }

  // Clean up session
  sessions.delete(sessionId);
  
  // Close SSE connections
  const connections = sseConnections.get(sessionId);
  if (connections) {
    connections.forEach(conn => conn.end());
    sseConnections.delete(sessionId);
  }

  res.status(204).send();
});

// Helper to check allowed origins
function isAllowedOrigin(origin) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:*'];
  return allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  });
}

// Send notification to all connected clients for a session
export function sendNotification(sessionId, notification) {
  const connections = sseConnections.get(sessionId);
  if (connections) {
    const event = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
    connections.forEach(conn => {
      try {
        conn.write(event);
      } catch (err) {
        // Connection might be closed
      }
    });
  }
}

// Start server only if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`MCP Agentic Framework HTTP server listening at http://127.0.0.1:${port}/mcp`);
    console.log('Security: Server bound to localhost only');
  });
}

export default app;