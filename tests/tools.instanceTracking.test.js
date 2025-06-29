import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  registerAgent, 
  unregisterAgent,
  unregisterAgentByInstance,
  resetInstances 
} from '../src/tools.js';
import { createInstanceTracker } from '../src/lib/instanceTracker.js';
import * as fs from 'fs/promises';

describe('Tool Handlers - Instance Tracking', () => {
  beforeEach(async () => {
    await resetInstances();
  });
  
  afterEach(async () => {
    // Clean up any test files
    try {
      await fs.rm('/tmp/mcp-claude-agent-mapping.json', { force: true });
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });
  
  describe('registerAgent with instanceId', () => {
    it('should register agent and track instance when instanceId is provided', async () => {
      const instanceId = 'test-session:1:0';
      const result = await registerAgent('TestAgent', 'Test agent with instance', instanceId);
      
      expect(result.content[0].text).toContain('registered successfully');
      expect(result.content[0].text).toContain('(instance tracked)');
      expect(result._meta.instanceTracked).toBe(true);
      
      // Verify instance was tracked
      const instanceTracker = createInstanceTracker();
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toMatchObject({
        agentId: result.structuredContent.id,
        agentName: 'TestAgent',
        instanceId
      });
    });
    
    it('should register agent without tracking when instanceId is not provided', async () => {
      const result = await registerAgent('TestAgent', 'Test agent without instance');
      
      expect(result.content[0].text).toContain('registered successfully');
      expect(result.content[0].text).not.toContain('(instance tracked)');
      expect(result._meta.instanceTracked).toBe(false);
    });
    
    it('should handle multiple agents with different instances', async () => {
      const instance1 = 'session1:1:0';
      const instance2 = 'session2:1:0';
      
      const agent1 = await registerAgent('Agent1', 'First agent', instance1);
      const agent2 = await registerAgent('Agent2', 'Second agent', instance2);
      
      const instanceTracker = createInstanceTracker();
      const mapping1 = await instanceTracker.getAgentByInstance(instance1);
      const mapping2 = await instanceTracker.getAgentByInstance(instance2);
      
      expect(mapping1.agentName).toBe('Agent1');
      expect(mapping2.agentName).toBe('Agent2');
    });
    
    it('should overwrite existing instance mapping', async () => {
      const instanceId = 'test-session:1:0';
      
      // Register first agent with instance
      const agent1 = await registerAgent('Agent1', 'First agent', instanceId);
      
      // Register second agent with same instance
      const agent2 = await registerAgent('Agent2', 'Second agent', instanceId);
      
      const instanceTracker = createInstanceTracker();
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      
      // Should have the second agent
      expect(mapping.agentId).toBe(agent2.structuredContent.id);
      expect(mapping.agentName).toBe('Agent2');
    });
  });
  
  describe('unregisterAgentByInstance', () => {
    it('should unregister agent by instance ID', async () => {
      const instanceId = 'test-session:1:0';
      
      // Register agent with instance
      const agent = await registerAgent('TestAgent', 'Test agent', instanceId);
      const agentId = agent.structuredContent.id;
      
      // Unregister by instance
      const result = await unregisterAgentByInstance(instanceId);
      
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.agentId).toBe(agentId);
      expect(result.structuredContent.agentName).toBe('TestAgent');
      expect(result.content[0].text).toContain('unregistered successfully');
      
      // Verify instance mapping was removed
      const instanceTracker = createInstanceTracker();
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toBeNull();
    });
    
    it('should return error for non-existent instance', async () => {
      const result = await unregisterAgentByInstance('non-existent:1:0');
      
      expect(result.structuredContent.success).toBe(false);
      expect(result.content[0].text).toContain('No agent found for instance');
    });
    
    it('should clean up instance tracking even if agent was already unregistered', async () => {
      const instanceId = 'test-session:1:0';
      
      // Register agent with instance
      const agent = await registerAgent('TestAgent', 'Test agent', instanceId);
      const agentId = agent.structuredContent.id;
      
      // Manually unregister agent (without using instance)
      await unregisterAgent(agentId);
      
      // Try to unregister by instance
      const result = await unregisterAgentByInstance(instanceId);
      
      // Agent unregistration will fail, but instance tracking should be cleaned up
      expect(result.structuredContent.success).toBe(false);
      
      // Verify instance mapping was still removed
      const instanceTracker = createInstanceTracker();
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toBeNull();
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle agent lifecycle with instance tracking', async () => {
      const instanceId = 'test-session:1:0';
      
      // 1. Register agent with instance
      const agent = await registerAgent('LifecycleAgent', 'Test lifecycle', instanceId);
      const agentId = agent.structuredContent.id;
      
      // 2. Verify agent exists and instance is tracked
      const instanceTracker = createInstanceTracker();
      let mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).not.toBeNull();
      expect(mapping.agentId).toBe(agentId);
      
      // 3. Unregister by instance
      await unregisterAgentByInstance(instanceId);
      
      // 4. Verify both agent and instance mapping are gone
      mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toBeNull();
    });
  });
});