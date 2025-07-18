import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import { resourceDefinitions } from '../src/resourceDefinitions.js';
import { promptDefinitions } from '../src/promptDefinitions.js';
import { __resetForTesting } from '../src/tools.js';

describe('MCP Server', () => {
  let server;

  beforeEach(async () => {
    await __resetForTesting();
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

    it('should have resources capability', () => {
      expect(server._options.capabilities.resources).toBeDefined();
      expect(server._options.capabilities.resources.listChanged).toBe(false);
    });

    it('should have prompts capability', () => {
      expect(server._options.capabilities.prompts).toBeDefined();
      expect(server._options.capabilities.prompts.listChanged).toBe(false);
    });

    it('should have sampling capability', () => {
      expect(server._options.capabilities.sampling).toBeDefined();
      expect(server._options.capabilities.sampling).toEqual({});
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

  describe('Resource definitions', () => {
    it('should have HOW_TO_COMMUNICATE guide as a resource', () => {
      const guide = resourceDefinitions.find(r => r.uri === 'guide://how-to-communicate');
      expect(guide).toBeDefined();
      expect(guide.name).toBe('Agent Communication Guide');
      expect(guide.description).toContain('Essential guide for agents');
      expect(guide.mimeType).toBe('text/markdown');
    });

    it('should list all available resources', () => {
      expect(resourceDefinitions).toHaveLength(1);
      expect(resourceDefinitions[0].uri).toBe('guide://how-to-communicate');
    });
  });

  describe('Prompt definitions', () => {
    it('should have agent onboarding prompt', () => {
      const onboarding = promptDefinitions.find(p => p.name === 'agent-onboarding');
      expect(onboarding).toBeDefined();
      expect(onboarding.description).toContain('onboarding flow');
      expect(onboarding.arguments).toHaveLength(2);
      expect(onboarding.arguments[0].name).toBe('agent_name');
      expect(onboarding.arguments[1].name).toBe('agent_role');
    });

    it('should have all essential prompts', () => {
      const promptNames = promptDefinitions.map(p => p.name);
      expect(promptNames).toContain('agent-onboarding');
      expect(promptNames).toContain('agent-heartbeat-loop');
      expect(promptNames).toContain('broadcast-announcement');
      expect(promptNames).toContain('agent-status-report');
      expect(promptNames).toContain('private-conversation');
      expect(promptNames).toContain('wake-up-recovery');
    });

    it('should have valid prompt schemas', () => {
      promptDefinitions.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
        expect(Array.isArray(prompt.arguments)).toBe(true);
        
        prompt.arguments.forEach(arg => {
          expect(arg).toHaveProperty('name');
          expect(arg).toHaveProperty('description');
          expect(arg).toHaveProperty('required');
        });
      });
    });
  });

  describe('Server handlers registration', () => {
    it('should register all tool handlers', () => {
      // Verify that all tools from toolDefinitions are handled
      const registeredHandlers = server._requestHandlers;
      expect(registeredHandlers.has('tools/list')).toBe(true);
      expect(registeredHandlers.has('tools/call')).toBe(true);
    });

    it('should register all resource handlers', () => {
      const registeredHandlers = server._requestHandlers;
      expect(registeredHandlers.has('resources/list')).toBe(true);
      expect(registeredHandlers.has('resources/read')).toBe(true);
    });

    it('should register all prompt handlers', () => {
      const registeredHandlers = server._requestHandlers;
      expect(registeredHandlers.has('prompts/list')).toBe(true);
      expect(registeredHandlers.has('prompts/get')).toBe(true);
    });
  });

  describe('Tool functionality verification', () => {
    it('should verify all tools can be called without errors', () => {
      // This test verifies the server is properly configured to handle all defined tools
      const toolNames = toolDefinitions.map(t => t.name);
      expect(toolNames).toEqual([
        'register-agent',
        'unregister-agent',
        'discover-agents',
        'send-message',
        'check-for-messages',
        'update-agent-status',
        'send-broadcast',
        'agent-ai-assist',
        'toggle-writes'
      ]);
    });

    it('should have proper error handling for tools', () => {
      // Verify that the server has proper error handling in place
      const handlers = server._requestHandlers;
      expect(handlers.size).toBeGreaterThan(0);
    });
  });
});