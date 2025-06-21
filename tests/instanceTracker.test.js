import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInstanceTracker } from '../src/lib/instanceTracker.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('InstanceTracker', () => {
  let instanceTracker;
  let testMappingFile;
  
  beforeEach(async () => {
    // Use unique test file for each test
    testMappingFile = `/tmp/test-instance-mapping-${Date.now()}.json`;
    instanceTracker = createInstanceTracker(testMappingFile);
  });
  
  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testMappingFile);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });
  
  describe('trackInstance', () => {
    it('should track a new instance-to-agent mapping', async () => {
      const instanceId = 'test-session:1:0';
      const agentId = 'agent-123';
      const agentName = 'TestAgent';
      
      const result = await instanceTracker.trackInstance(instanceId, agentId, agentName);
      
      expect(result).toEqual({
        success: true,
        instanceId,
        agentId
      });
      
      // Verify mapping was saved
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toMatchObject({
        agentId,
        agentName,
        instanceId,
        registeredAt: expect.any(String)
      });
    });
    
    it('should overwrite existing mapping for same instance', async () => {
      const instanceId = 'test-session:1:0';
      
      // First registration
      await instanceTracker.trackInstance(instanceId, 'agent-123', 'Agent1');
      
      // Second registration with same instance
      await instanceTracker.trackInstance(instanceId, 'agent-456', 'Agent2');
      
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping.agentId).toBe('agent-456');
      expect(mapping.agentName).toBe('Agent2');
    });
    
    it('should throw error if instanceId is missing', async () => {
      await expect(instanceTracker.trackInstance(null, 'agent-123', 'TestAgent'))
        .rejects.toThrow('Both instanceId and agentId are required');
    });
    
    it('should throw error if agentId is missing', async () => {
      await expect(instanceTracker.trackInstance('instance-123', null, 'TestAgent'))
        .rejects.toThrow('Both instanceId and agentId are required');
    });
  });
  
  describe('untrackInstance', () => {
    it('should remove instance mapping and return agent info', async () => {
      const instanceId = 'test-session:1:0';
      const agentId = 'agent-123';
      const agentName = 'TestAgent';
      
      await instanceTracker.trackInstance(instanceId, agentId, agentName);
      
      const result = await instanceTracker.untrackInstance(instanceId);
      
      expect(result).toEqual({
        success: true,
        agentId,
        agentName
      });
      
      // Verify mapping was removed
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).toBeNull();
    });
    
    it('should return error for non-existent instance', async () => {
      const result = await instanceTracker.untrackInstance('non-existent');
      
      expect(result).toEqual({
        success: false,
        message: 'Instance not found'
      });
    });
    
    it('should throw error if instanceId is missing', async () => {
      await expect(instanceTracker.untrackInstance(null))
        .rejects.toThrow('instanceId is required');
    });
  });
  
  describe('getAgentByInstance', () => {
    it('should return mapping for existing instance', async () => {
      const instanceId = 'test-session:1:0';
      const agentId = 'agent-123';
      const agentName = 'TestAgent';
      
      await instanceTracker.trackInstance(instanceId, agentId, agentName);
      
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      
      expect(mapping).toMatchObject({
        agentId,
        agentName,
        instanceId
      });
    });
    
    it('should return null for non-existent instance', async () => {
      const mapping = await instanceTracker.getAgentByInstance('non-existent');
      expect(mapping).toBeNull();
    });
    
    it('should return null if instanceId is null', async () => {
      const mapping = await instanceTracker.getAgentByInstance(null);
      expect(mapping).toBeNull();
    });
  });
  
  describe('getAllMappings', () => {
    it('should return all instance mappings', async () => {
      await instanceTracker.trackInstance('session1:1:0', 'agent-1', 'Agent1');
      await instanceTracker.trackInstance('session2:1:0', 'agent-2', 'Agent2');
      
      const mappings = await instanceTracker.getAllMappings();
      
      expect(Object.keys(mappings)).toHaveLength(2);
      expect(mappings['session1:1:0']).toMatchObject({
        agentId: 'agent-1',
        agentName: 'Agent1'
      });
      expect(mappings['session2:1:0']).toMatchObject({
        agentId: 'agent-2',
        agentName: 'Agent2'
      });
    });
    
    it('should return empty object when no mappings exist', async () => {
      const mappings = await instanceTracker.getAllMappings();
      expect(mappings).toEqual({});
    });
  });
  
  describe('clearStaleInstances', () => {
    it('should remove instances older than specified hours', async () => {
      const instanceId = 'old-session:1:0';
      
      // Track an instance
      await instanceTracker.trackInstance(instanceId, 'agent-123', 'OldAgent');
      
      // Manually set old timestamp
      const mappings = await instanceTracker.getAllMappings();
      mappings[instanceId].registeredAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      
      // Save manually modified mappings
      await fs.writeFile(testMappingFile, JSON.stringify(mappings));
      
      // Clear stale instances (older than 24 hours)
      const result = await instanceTracker.clearStaleInstances(24);
      
      expect(result.cleared).toBe(1);
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0]).toMatchObject({
        instanceId,
        agentId: 'agent-123',
        agentName: 'OldAgent'
      });
      
      // Verify instance was removed
      const remaining = await instanceTracker.getAllMappings();
      expect(Object.keys(remaining)).toHaveLength(0);
    });
    
    it('should keep recent instances', async () => {
      const instanceId = 'recent-session:1:0';
      
      await instanceTracker.trackInstance(instanceId, 'agent-123', 'RecentAgent');
      
      const result = await instanceTracker.clearStaleInstances(24);
      
      expect(result.cleared).toBe(0);
      expect(result.instances).toHaveLength(0);
      
      // Verify instance still exists
      const mapping = await instanceTracker.getAgentByInstance(instanceId);
      expect(mapping).not.toBeNull();
    });
  });
  
  describe('concurrent access', () => {
    it('should handle concurrent track operations safely', async () => {
      const promises = [];
      
      // Create multiple concurrent track operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          instanceTracker.trackInstance(`session:${i}:0`, `agent-${i}`, `Agent${i}`)
        );
      }
      
      await Promise.all(promises);
      
      const mappings = await instanceTracker.getAllMappings();
      expect(Object.keys(mappings)).toHaveLength(10);
    });
  });
});