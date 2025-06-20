import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAgentRegistry } from '../src/lib/agentRegistry.js';
import { createNotificationManager } from '../src/lib/notificationManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Agent Registry', () => {
  let registry;
  let notificationManager;
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
    notificationManager = createNotificationManager();
    registry = createAgentRegistry(storagePath, notificationManager);
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
      expect(agents[result.id]).toMatchObject({
        id: result.id,
        name: 'TestAgent',
        description: 'A test agent',
        status: 'online',
        registeredAt: expect.any(String),
        lastActivityAt: expect.any(String)
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
      expect(agents).toContainEqual(expect.objectContaining({
        id: agent1.id,
        name: 'Agent1',
        description: 'First agent',
        status: 'online'
      }));
      expect(agents).toContainEqual(expect.objectContaining({
        id: agent2.id,
        name: 'Agent2',
        description: 'Second agent',
        status: 'online'
      }));
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
      
      expect(agent).toMatchObject({
        id,
        name: 'TestAgent',
        description: 'A test agent',
        status: 'online',
        registeredAt: expect.any(String),
        lastActivityAt: expect.any(String)
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

  describe('updateAgentStatus', () => {
    it('should update agent status', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      
      const result = await registry.updateAgentStatus(id, 'busy');
      
      expect(result).toEqual({
        success: true,
        previousStatus: 'online',
        newStatus: 'busy'
      });
      
      // Verify the status was updated
      const agent = await registry.getAgent(id);
      expect(agent.status).toBe('busy');
    });

    it('should validate status values', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      
      await expect(registry.updateAgentStatus(id, 'invalid-status'))
        .rejects.toThrow('Invalid status');
    });

    it('should return error for non-existent agent', async () => {
      const result = await registry.updateAgentStatus('non-existent', 'offline');
      
      expect(result).toEqual({
        success: false,
        message: 'Agent not found'
      });
    });

    it('should emit notification when status changes', async () => {
      const notifySpy = vi.spyOn(notificationManager, 'notifyAgentStatusChange');
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      
      await registry.updateAgentStatus(id, 'offline');
      
      expect(notifySpy).toHaveBeenCalledWith(id, 'offline', {
        previousStatus: 'online',
        agentName: 'TestAgent'
      });
    });

    it('should not emit notification if status unchanged', async () => {
      const notifySpy = vi.spyOn(notificationManager, 'notifyAgentStatusChange');
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      
      // Status is already 'online' by default
      await registry.updateAgentStatus(id, 'online');
      
      expect(notifySpy).not.toHaveBeenCalled();
    });
  });

  describe('updateAgentActivity', () => {
    it('should update agent last activity timestamp', async () => {
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      const agent1 = await registry.getAgent(id);
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await registry.updateAgentActivity(id);
      
      expect(result).toEqual({ success: true });
      
      const agent2 = await registry.getAgent(id);
      expect(agent2.lastActivityAt).not.toBe(agent1.lastActivityAt);
    });

    it('should return false for non-existent agent', async () => {
      const result = await registry.updateAgentActivity('non-existent');
      
      expect(result).toEqual({ success: false });
    });
  });

  describe('getAgentsByStatus', () => {
    it('should return agents with specific status', async () => {
      const agent1 = await registry.registerAgent('Agent1', 'First agent');
      const agent2 = await registry.registerAgent('Agent2', 'Second agent');
      const agent3 = await registry.registerAgent('Agent3', 'Third agent');
      
      // Update statuses
      await registry.updateAgentStatus(agent1.id, 'busy');
      await registry.updateAgentStatus(agent2.id, 'offline');
      
      const onlineAgents = await registry.getAgentsByStatus('online');
      const busyAgents = await registry.getAgentsByStatus('busy');
      const offlineAgents = await registry.getAgentsByStatus('offline');
      
      expect(onlineAgents).toHaveLength(1);
      expect(onlineAgents[0].name).toBe('Agent3');
      
      expect(busyAgents).toHaveLength(1);
      expect(busyAgents[0].name).toBe('Agent1');
      
      expect(offlineAgents).toHaveLength(1);
      expect(offlineAgents[0].name).toBe('Agent2');
    });

    it('should return empty array when no agents match status', async () => {
      await registry.registerAgent('Agent1', 'First agent');
      
      const awayAgents = await registry.getAgentsByStatus('away');
      
      expect(awayAgents).toEqual([]);
    });
  });

  describe('notifications', () => {
    it('should emit notification when agent is registered', async () => {
      const notifySpy = vi.spyOn(notificationManager, 'notifyAgentRegistered');
      
      const result = await registry.registerAgent('NewAgent', 'A new agent');
      
      expect(notifySpy).toHaveBeenCalledWith(
        result.id,
        'NewAgent',
        'A new agent'
      );
    });

    it('should emit notification when agent is unregistered', async () => {
      const notifySpy = vi.spyOn(notificationManager, 'notifyAgentUnregistered');
      const { id } = await registry.registerAgent('TestAgent', 'A test agent');
      
      await registry.unregisterAgent(id);
      
      expect(notifySpy).toHaveBeenCalledWith(id);
    });
  });
});