import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions } from './toolDefinitions.js';
import { resourceDefinitions, getResourceContent } from './resourceDefinitions.js';
import { 
  registerAgent, 
  unregisterAgent, 
  discoverAgents, 
  sendMessage, 
  checkForMessages,
  updateAgentStatus,
  sendBroadcast,
  setPushNotificationSender
} from './tools.js';
import { Errors, MCPError } from './errors.js';

export function createServer() {
  const server = new Server(
    {
      name: 'mcp-agentic-framework',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {
          // We don't support dynamic tool list changes
          listChanged: false
        },
        resources: {
          // We support resources
          listChanged: false
        },
        // Future capabilities can be added:
        // prompts: {},
        // logging: {},
        // completions: {}
      },
    }
  );
  
  // Store reference to server instance for notifications
  global.mcpServer = server;
  
  // Set up push notification sender
  setPushNotificationSender(async (method, params) => {
    try {
      await server.notification({ method, params });
      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  });

  // Define available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Define available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefinitions,
  }));

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    try {
      const content = await getResourceContent(uri);
      return {
        contents: [content]
      };
    } catch (error) {
      throw Errors.resourceNotFound(uri);
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'register-agent': {
          const { name: agentName, description, instanceId } = args;
          return await registerAgent(agentName, description, instanceId);
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

        case 'send-broadcast': {
          const { from, message, priority } = args;
          return await sendBroadcast(from, message, priority);
        }



        default:
          throw Errors.toolNotFound(name);
      }
    } catch (error) {
      // If it's already an MCPError, re-throw it
      if (error instanceof MCPError) {
        throw error;
      }
      
      // Otherwise, wrap it as an internal error
      throw Errors.internalError(error.message);
    }
  });

  return server;
}

// Function to send custom notifications
export async function sendCustomNotification(method, params) {
  if (!global.mcpServer) {
    throw new Error('MCP server not initialized');
  }
  
  try {
    // Send notification without ID (per JSON-RPC spec)
    await global.mcpServer.notification({
      method,
      params
    });
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}