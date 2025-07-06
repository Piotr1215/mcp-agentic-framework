import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  registerAgent, 
  sendBroadcast, 
  checkForMessages, 
  resetInstances 
} from '../src/tools.js';
import * as fs from 'fs/promises';

describe('Broadcast Feature', () => {
  beforeEach(async () => {
    // Clean up storage before each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    // Reset singleton instances
    await resetInstances();
  });

  afterEach(async () => {
    // Clean up storage after each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  describe('Broadcast to all agents', () => {
    it('should deliver broadcast to all registered agents without subscription', async () => {
      // Given: Three agents are registered
      const agent1Result = await registerAgent('orchestrator', 'Main orchestrator agent');
      const agent2Result = await registerAgent('worker1', 'First worker agent');
      const agent3Result = await registerAgent('worker2', 'Second worker agent');
      
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;
      const agent3Id = agent3Result.structuredContent.id;

      // When: A broadcast is sent
      const result = await sendBroadcast(agent1Id, 'Test broadcast message', 'normal');

      // Then: Broadcast should be sent successfully
      expect(result.content[0].text).toContain('Broadcast sent');
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.recipientCount).toBe(2);
      
      // Check that all agents (except sender) received the message
      const agent2Messages = await checkForMessages(agent2Id);
      const agent3Messages = await checkForMessages(agent3Id);
      const agent1Messages = await checkForMessages(agent1Id);
      
      expect(agent2Messages.structuredContent.messages.length).toBe(1);
      expect(agent2Messages.structuredContent.messages[0].message).toContain('Test broadcast message');
      expect(agent2Messages.structuredContent.messages[0].from).toBe(agent1Id);
      
      expect(agent3Messages.structuredContent.messages.length).toBe(1);
      expect(agent3Messages.structuredContent.messages[0].message).toContain('Test broadcast message');
      expect(agent3Messages.structuredContent.messages[0].from).toBe(agent1Id);
      
      // Sender should not receive their own broadcast
      expect(agent1Messages.structuredContent.messages.length).toBe(0);
    });

    it('should not deliver broadcast to sender', async () => {
      // Given: Two agents are registered
      const agent1Result = await registerAgent('agent1', 'Test agent 1');
      const agent2Result = await registerAgent('agent2', 'Test agent 2');
      
      const agent1Id = agent1Result.structuredContent.id;

      // When: Agent1 sends a broadcast
      await sendBroadcast(agent1Id, 'Test broadcast', 'normal');

      // Then: Agent1 should not receive its own broadcast
      const agent1Messages = await checkForMessages(agent1Id);
      expect(agent1Messages.structuredContent.messages.length).toBe(0);
    });

    it('should handle priority levels correctly', async () => {
      // Given: Two agents are registered
      const agent1Result = await registerAgent('agent1', 'Test agent 1');
      const agent2Result = await registerAgent('agent2', 'Test agent 2');
      
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;

      // When: Broadcasts with different priorities are sent
      await sendBroadcast(agent1Id, 'Low priority broadcast', 'low');
      await sendBroadcast(agent1Id, 'High priority broadcast', 'high');
      await sendBroadcast(agent1Id, 'Normal priority broadcast', 'normal');

      // Then: Messages should be received with correct priorities
      const messages = await checkForMessages(agent2Id);
      expect(messages.structuredContent.messages.length).toBe(3);
      
      // Check that all priority levels are present (order not guaranteed)
      const messageTexts = messages.structuredContent.messages.map(m => m.message);
      
      expect(messageTexts.some(m => m.includes('[BROADCAST LOW]') && m.includes('Low priority'))).toBe(true);
      expect(messageTexts.some(m => m.includes('[BROADCAST HIGH]') && m.includes('High priority'))).toBe(true);
      expect(messageTexts.some(m => m.includes('[BROADCAST NORMAL]') && m.includes('Normal priority'))).toBe(true);
    });

    it('should work without any subscriptions', async () => {
      // Given: Agents with no subscriptions
      const agent1Result = await registerAgent('agent1', 'Test agent 1');
      const agent2Result = await registerAgent('agent2', 'Test agent 2');
      
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;

      // No subscriptions are created

      // When: A broadcast is sent
      const result = await sendBroadcast(agent1Id, 'No subscription needed', 'normal');

      // Then: Broadcast should still be delivered
      expect(result.structuredContent.success).toBe(true);
      const messages = await checkForMessages(agent2Id);
      expect(messages.structuredContent.messages.length).toBe(1);
      expect(messages.structuredContent.messages[0].message).toContain('No subscription needed');
    });

    it('should handle empty agent registry gracefully', async () => {
      // Given: Only one agent is registered
      const agent1Result = await registerAgent('agent1', 'Test agent 1');
      const agent1Id = agent1Result.structuredContent.id;

      // When: A broadcast is sent
      const result = await sendBroadcast(agent1Id, 'Test broadcast', 'normal');

      // Then: Should succeed even with no recipients
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.recipientCount).toBe(0);
      expect(result.content[0].text).toContain('no recipients');
    });

    it('should fail gracefully for invalid sender', async () => {
      // When: A broadcast is attempted with invalid sender
      await expect(sendBroadcast('non-existent-agent', 'Test broadcast', 'normal'))
        .rejects.toThrow('not found');
    });
  });

  describe('Functional programming approach', () => {
    it('should handle multiple broadcasts correctly', async () => {
      // Test that broadcast delivery works consistently
      const agent1Result = await registerAgent('agent1', 'Test agent 1');
      const agent2Result = await registerAgent('agent2', 'Test agent 2');
      
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;

      // Send first broadcast and check
      const result1 = await sendBroadcast(agent1Id, 'First broadcast', 'normal');
      expect(result1.structuredContent.success).toBe(true);
      
      const messages1 = await checkForMessages(agent2Id);
      expect(messages1.structuredContent.messages.length).toBe(1);
      expect(messages1.structuredContent.messages[0].message).toContain('First broadcast');
      
      // Send second broadcast and check
      const result2 = await sendBroadcast(agent1Id, 'Second broadcast', 'normal');
      expect(result2.structuredContent.success).toBe(true);
      
      const messages2 = await checkForMessages(agent2Id);
      expect(messages2.structuredContent.messages.length).toBe(1);
      expect(messages2.structuredContent.messages[0].message).toContain('Second broadcast');
    });
  });
});