import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateAgentStatus,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  sendBroadcast,
  getPendingNotifications,
  resetInstances
} from '../src/tools.js';
import { registerAgent, unregisterAgent } from '../src/tools.js';

describe('Notification Tools', () => {
  beforeEach(async () => {
    await resetInstances();
  });

  describe('updateAgentStatus', () => {
    it('should update agent status successfully', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      const result = await updateAgentStatus(agentId, 'busy');

      expect(result.content).toHaveLength(1);
      expect(result.structuredContent).toMatchObject({
        success: true,
        previousStatus: expect.any(String),
        newStatus: 'busy'
      });
      expect(result.content[0].text).toMatch(/Agent status updated from .* to 'busy'/);
    });

    it('should handle invalid status', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      // Empty status should fail
      await expect(updateAgentStatus(agentId, ''))
        .rejects.toThrow('Status is required');
        
      // Status too long should fail
      const longStatus = 'x'.repeat(101);
      await expect(updateAgentStatus(agentId, longStatus))
        .rejects.toThrow('Status must be 100 characters or less');
    });

    it('should handle non-existent agent', async () => {
      const result = await updateAgentStatus('non-existent-id', 'offline');
      
      expect(result.structuredContent).toMatchObject({
        success: false,
        message: 'Agent not found'
      });
    });
  });

  describe('subscribeToNotifications', () => {
    it('should subscribe agent to notifications', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      const result = await subscribeToNotifications(agentId, ['agent/*', 'message/*']);

      expect(result.structuredContent).toMatchObject({
        success: true
      });
      expect(result.content[0].text).toContain("Agent 'TestAgent' subscribed to notifications: agent/*, message/*");
    });

    it('should handle non-existent agent', async () => {
      await expect(subscribeToNotifications('non-existent-id', ['agent/*']))
        .rejects.toThrow('Agent not found');
    });

    it('should handle invalid parameters', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      await expect(subscribeToNotifications(agentId, []))
        .rejects.toThrow('Events array is required');
    });
  });

  describe('unsubscribeFromNotifications', () => {
    it('should unsubscribe agent from all notifications', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      // First subscribe
      await subscribeToNotifications(agentId, ['agent/*', 'message/*']);

      // Then unsubscribe
      const result = await unsubscribeFromNotifications(agentId);

      expect(result.structuredContent).toMatchObject({
        success: true
      });
      expect(result.content[0].text).toContain("Agent 'TestAgent' unsubscribed from all notifications");
    });

    it('should unsubscribe from specific events', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      // First subscribe
      await subscribeToNotifications(agentId, ['agent/*', 'message/*', 'broadcast/*']);

      // Then unsubscribe from specific events
      const result = await unsubscribeFromNotifications(agentId, ['agent/*']);

      expect(result.structuredContent).toMatchObject({
        success: true
      });
      expect(result.content[0].text).toContain("Agent 'TestAgent' unsubscribed from: agent/*");
    });

    it('should handle non-existent agent', async () => {
      await expect(unsubscribeFromNotifications('non-existent-id'))
        .rejects.toThrow('Agent not found');
    });
  });

  describe('sendBroadcast', () => {
    it('should send broadcast message successfully', async () => {
      const registerResult = await registerAgent('SystemAgent', 'System agent');
      const agentId = registerResult.structuredContent.id;

      const result = await sendBroadcast(agentId, 'Server maintenance in 10 minutes', 'high');

      expect(result.structuredContent).toMatchObject({
        success: true
      });
      expect(result.content[0].text).toMatch(/Broadcast sent from SystemAgent (to \d+ agents? )?with high priority/);
    });

    it('should use default priority', async () => {
      const registerResult = await registerAgent('SystemAgent', 'System agent');
      const agentId = registerResult.structuredContent.id;

      const result = await sendBroadcast(agentId, 'Hello everyone');

      expect(result.content[0].text).toMatch(/Broadcast sent from SystemAgent (to \d+ agents? )?with normal priority/);
    });

    it('should handle non-existent sender', async () => {
      await expect(sendBroadcast('non-existent-id', 'Message'))
        .rejects.toThrow('Sender agent not found');
    });
  });

  describe('getPendingNotifications', () => {
    it('should get pending notifications for agent', async () => {
      const registerResult = await registerAgent('TestAgent', 'A test agent');
      const agentId = registerResult.structuredContent.id;

      const result = await getPendingNotifications(agentId);

      expect(result.structuredContent).toEqual({ notifications: [] });
      expect(result.content[0].text).toContain("No pending notifications for agent 'TestAgent'");
    });

    it('should retrieve stored notifications', async () => {
      const agent1Result = await registerAgent('Agent1', 'First agent');
      const agent2Result = await registerAgent('Agent2', 'Second agent');
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;

      // Subscribe agent2 to notifications
      await subscribeToNotifications(agent2Id, ['message/*']);

      // Send a message to trigger notification storage
      const { sendMessage } = await import('../src/tools.js');
      await sendMessage(agent2Id, agent1Id, 'Hello');

      // Get pending notifications
      const result = await getPendingNotifications(agent2Id);

      expect(result.structuredContent.notifications.length).toBeGreaterThan(0);
      expect(result.content[0].text).toContain('Retrieved');
    });

    it('should handle non-existent agent', async () => {
      await expect(getPendingNotifications('non-existent-id'))
        .rejects.toThrow('Agent not found');
    });
  });

  describe('integration', () => {
    it('should handle full notification flow', async () => {
      // Register agents
      const agent1Result = await registerAgent('Producer', 'Produces messages');
      const agent2Result = await registerAgent('Consumer', 'Consumes messages');
      const agent1Id = agent1Result.structuredContent.id;
      const agent2Id = agent2Result.structuredContent.id;

      // Subscribe consumer to notifications
      await subscribeToNotifications(agent2Id, ['message/*', 'broadcast/*']);

      // Update producer status
      await updateAgentStatus(agent1Id, 'busy');

      // Send broadcast
      await sendBroadcast(agent1Id, 'System update available', 'high');

      // Check pending notifications
      const result = await getPendingNotifications(agent2Id);
      
      expect(result.structuredContent.notifications.length).toBeGreaterThan(0);
      
      // Find broadcast notification
      const broadcastNotif = result.structuredContent.notifications.find(n => 
        n.method === 'broadcast/message'
      );
      expect(broadcastNotif).toBeDefined();
      expect(broadcastNotif.params.message).toBe('System update available');
      expect(broadcastNotif.params.priority).toBe('high');
    });

    it('should notify all agents when new agent is registered', async () => {
      // Create first agent and subscribe to agent notifications
      const observer = await registerAgent('Observer', 'Watches for new agents');
      const observerId = observer.structuredContent.id;
      
      await subscribeToNotifications(observerId, ['agent/registered']);
      
      // Register a new agent - this should trigger a notification
      const newAgent = await registerAgent('NewAgent', 'Just joined the system');
      const newAgentId = newAgent.structuredContent.id;
      
      // Check that observer received the notification
      const notifications = await getPendingNotifications(observerId);
      
      expect(notifications.structuredContent.notifications).toHaveLength(1);
      expect(notifications.structuredContent.notifications[0]).toMatchObject({
        method: 'agent/registered',
        params: {
          agentId: newAgentId,
          name: 'NewAgent',
          description: 'Just joined the system'
        }
      });
    });

    it('should notify when agent is unregistered', async () => {
      // Create two agents
      const watcher = await registerAgent('Watcher', 'Monitors agent lifecycle');
      const temporary = await registerAgent('TempAgent', 'Will be removed');
      const watcherId = watcher.structuredContent.id;
      const tempId = temporary.structuredContent.id;
      
      // Subscribe watcher to unregister events only
      await subscribeToNotifications(watcherId, ['agent/unregistered']);
      
      // Unregister the temporary agent
      await unregisterAgent(tempId);
      
      // Check notifications
      const notifications = await getPendingNotifications(watcherId);
      
      expect(notifications.structuredContent.notifications).toHaveLength(1);
      expect(notifications.structuredContent.notifications[0]).toMatchObject({
        method: 'agent/unregistered',
        params: {
          agentId: tempId
        }
      });
    });

    it('should handle wildcard subscriptions correctly', async () => {
      // Create monitoring agent
      const monitor = await registerAgent('Monitor', 'Monitors all activity');
      const monitorId = monitor.structuredContent.id;
      
      // Subscribe to all agent events with wildcard
      await subscribeToNotifications(monitorId, ['agent/*']);
      
      // Trigger multiple agent events
      const agent2 = await registerAgent('ActiveAgent', 'Does things');
      const agent2Id = agent2.structuredContent.id;
      
      await updateAgentStatus(agent2Id, 'away');
      await registerAgent('ThirdAgent', 'Another new agent');
      await unregisterAgent(agent2Id);
      
      // Check all notifications were received
      const notifications = await getPendingNotifications(monitorId);
      
      // Count unique notification types
      const uniqueMethods = [...new Set(notifications.structuredContent.notifications.map(n => n.method))];
      
      // Should have: agent/registered (for both new agents), agent/statusChanged, agent/unregistered
      expect(uniqueMethods).toContain('agent/registered');
      expect(uniqueMethods).toContain('agent/statusChanged');
      expect(uniqueMethods).toContain('agent/unregistered');
      
      // Count specific notifications
      const registeredCount = notifications.structuredContent.notifications.filter(n => n.method === 'agent/registered').length;
      expect(registeredCount).toBe(2); // ActiveAgent and ThirdAgent
    });

    it('should clear notifications after retrieval', async () => {
      const agent = await registerAgent('NotificationClearer', 'Tests notification clearing');
      const broadcaster = await registerAgent('SystemBroadcaster', 'Sends broadcasts');
      const agentId = agent.structuredContent.id;
      const broadcasterId = broadcaster.structuredContent.id;
      
      await subscribeToNotifications(agentId, ['broadcast/*']);
      await sendBroadcast(broadcasterId, 'Test broadcast', 'normal');
      
      // First retrieval should have notifications
      const first = await getPendingNotifications(agentId);
      expect(first.structuredContent.notifications).toHaveLength(1);
      
      // Second retrieval should be empty
      const second = await getPendingNotifications(agentId);
      expect(second.structuredContent.notifications).toHaveLength(0);
    });
  });
});