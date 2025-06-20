#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('MCP Agentic Framework server running');