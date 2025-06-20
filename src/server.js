import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions } from './toolDefinitions.js';
import { registerAgent, unregisterAgent, discoverAgents, sendMessage, checkForMessages } from './tools.js';
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
        // Future capabilities can be added:
        // resources: {},
        // prompts: {},
        // logging: {},
        // completions: {}
      },
    }
  );

  // Define available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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