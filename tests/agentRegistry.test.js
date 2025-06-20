import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAgentRegistry } from '../src/lib/agentRegistry.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Agent Registry', () => {
  let registry;
  const storagePath = '/tmp/mcp-agentic-test/test-agents.json';

  beforeEach(async () => {
    // Ensure storage directory exists
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    // Clean up any existing file
    try {
      await fs.unlink(storagePath);
    } catch (e) {
      // File might not exist
    }
    registry = createAgentRegistry(storagePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(storagePath);
    } catch (e) {
      // File might not exist
    }
  });

  describe('registerAgent', () => {
    it('should register a new agent with generated id', async () => {
      const result = await registry.registerAgent('TestAgent', 'A test agent for testing');
      
      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should persist agent data to storage', async () => {
      const result = await registry.registerAgent('TestAgent', 'A test agent');
      
      const data = await fs.readFile(storagePath, 'utf-8');
      const agents = JSON.parse(data);
      
      expect(agents).toHaveProperty(result.id);
      expect(agents[result.id]).toEqual({
        id: result.id,
        name: 'TestAgent',
        description: 'A test agent',
        registeredAt: expect.any(String)
      });
    });

    it('should handle concurrent registrations', async () => {
      const promises = [
        registry.registerAgent('Agent1', 'First agent'),
        registry.registerAgent('Agent2', 'Second agent'),
        registry.registerAgent('Agent3', 'Third agent')
      ];
      
      const results = await Promise.all(promises);
      const ids = results.map(r => r.id);
      
      expect(new Set(ids).size).toBe(3); // All IDs should be unique
    });

    it('should validate agent name', async () => {
      await expect(registry.registerAgent('', 'Description')).rejects.toThrow('Agent name is required');
      await expect(registry.registerAgent(null, 'Description')).rejects.toThrow('Agent name is required');
    });

    it('should validate agent description', async () => {
      await expect(registry.registerAgent('Agent', '')).rejects.toThrow('Agent description is required');
      await expect(registry.registerAgent('Agent', null)).rejects.toThrow('Agent description is required');
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an existing agent', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      const result = await registry.unregisterAgent(id);
      
      expect(result).toEqual({ success: true });
    });

    it('should remove agent from storage', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      await registry.unregisterAgent(id);
      
      const data = await fs.readFile(storagePath, 'utf-8');
      const agents = JSON.parse(data);
      
      expect(agents).not.toHaveProperty(id);
    });

    it('should return success false for non-existent agent', async () => {
      const result = await registry.unregisterAgent('non-existent-id');
      
      expect(result).toEqual({ success: false });
    });

    it('should validate agent id', async () => {
      await expect(registry.unregisterAgent('')).rejects.toThrow('Agent id is required');
      await expect(registry.unregisterAgent(null)).rejects.toThrow('Agent id is required');
    });
  });

  describe('discoverAgents', () => {
    it('should return empty array when no agents registered', async () => {
      const agents = await registry.discoverAgents();
      
      expect(agents).toEqual([]);
    });

    it('should return all registered agents', async () => {
      const agent1 = await registry.registerAgent('Agent1', 'First agent');
      const agent2 = await registry.registerAgent('Agent2', 'Second agent');
      
      const agents = await registry.discoverAgents();
      
      expect(agents).toHaveLength(2);
      expect(agents).toContainEqual({
        id: agent1.id,
        name: 'Agent1',
        description: 'First agent'
      });
      expect(agents).toContainEqual({
        id: agent2.id,
        name: 'Agent2',
        description: 'Second agent'
      });
    });

    it('should not include unregistered agents', async () => {
      const agent1 = await registry.registerAgent('Agent1', 'First agent');
      const agent2 = await registry.registerAgent('Agent2', 'Second agent');
      
      // Verify both are registered
      let agents = await registry.discoverAgents();
      expect(agents).toHaveLength(2);
      
      // Unregister agent1
      await registry.unregisterAgent(agent1.id);
      
      // Now only agent2 should remain
      agents = await registry.discoverAgents();
      
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agent2.id);
    });
  });

  describe('getAgent', () => {
    it('should return agent details for existing agent', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      const agent = await registry.getAgent(id);
      
      expect(agent).toEqual({
        id,
        name: 'TestAgent',
        description: 'A test agent',
        registeredAt: expect.any(String)
      });
    });

    it('should return null for non-existent agent', async () => {
      const agent = await registry.getAgent('non-existent-id');
      
      expect(agent).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should load existing agents on initialization', async () => {
      const agent1 = await registry.registerAgent('Agent1', 'First agent');
      
      // Create new registry instance
      const newRegistry = createAgentRegistry(storagePath);
      const agents = await newRegistry.discoverAgents();
      
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agent1.id);
    });

    it('should handle corrupted storage file', async () => {
      // Ensure directory exists
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, 'invalid json');
      
      const newRegistry = createAgentRegistry(storagePath);
      const agents = await newRegistry.discoverAgents();
      
      expect(agents).toEqual([]);
    });
  });
});