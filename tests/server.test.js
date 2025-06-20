import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { toolDefinitions } from '../src/toolDefinitions.js';

describe('MCP Server', () => {
  let server;

  beforeEach(() => {
    server = createServer();
  });

  describe('Server initialization', () => {
    it('should have correct server metadata', () => {
      expect(server._serverInfo.name).toBe('mcp-agentic-framework');
      expect(server._serverInfo.version).toBe('1.0.0');
    });

    it('should have tools capability', () => {
      expect(server._options.capabilities.tools).toBeDefined();
      expect(server._options.capabilities.tools.listChanged).toBe(false);
    });
  });

  describe('Tool definitions', () => {
    it('should have all required tools', () => {
      const toolNames = toolDefinitions.map(t => t.name);
      expect(toolNames).toContain('register-agent');
      expect(toolNames).toContain('unregister-agent');
      expect(toolNames).toContain('discover-agents');
      expect(toolNames).toContain('send-message');
      expect(toolNames).toContain('check-for-messages');
    });

    it('should have valid JSON schemas for all tools', () => {
      toolDefinitions.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('title');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('$schema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('additionalProperties', false);
      });
    });

    it('should have required fields properly defined', () => {
      const registerTool = toolDefinitions.find(t => t.name === 'register-agent');
      expect(registerTool.inputSchema.required).toEqual(['name', 'description']);

      const sendTool = toolDefinitions.find(t => t.name === 'send-message');
      expect(sendTool.inputSchema.required).toEqual(['to', 'from', 'message']);

      const checkTool = toolDefinitions.find(t => t.name === 'check-for-messages');
      expect(checkTool.inputSchema.required).toEqual(['agent_id']);
    });

    it('should follow kebab-case naming convention', () => {
      toolDefinitions.forEach(tool => {
        expect(tool.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });
    });
  });
});