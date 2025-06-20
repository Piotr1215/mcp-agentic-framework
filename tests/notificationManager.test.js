import { describe, it, expect, beforeEach } from 'vitest';
import { createNotificationManager, NotificationTypes, AgentStatus } from '../src/lib/notificationManager.js';

describe('NotificationManager', () => {
  let notificationManager;

  beforeEach(() => {
    notificationManager = createNotificationManager();
  });

  describe('subscribe', () => {
    it('should successfully subscribe an agent to notifications', () => {
      const agentId = 'agent-123';
      const events = ['agent/*', 'message/*'];
      const callback = () => {};

      const result = notificationManager.subscribe(agentId, events, callback);

      expect(result.success).toBe(true);
    });

    it('should throw error for invalid agent ID', () => {
      expect(() => {
        notificationManager.subscribe('', ['agent/*'], () => {});
      }).toThrow('Agent ID is required');

      expect(() => {
        notificationManager.subscribe(null, ['agent/*'], () => {});
      }).toThrow('Agent ID is required');
    });

    it('should throw error for invalid events', () => {
      expect(() => {
        notificationManager.subscribe('agent-123', [], () => {});
      }).toThrow('Events array is required');

      expect(() => {
        notificationManager.subscribe('agent-123', 'not-an-array', () => {});
      }).toThrow('Events array is required');
    });

    it('should throw error for invalid callback', () => {
      expect(() => {
        notificationManager.subscribe('agent-123', ['agent/*'], 'not-a-function');
      }).toThrow('Callback function is required');
    });
  });

  describe('unsubscribe', () => {
    it('should successfully unsubscribe an agent', () => {
      const agentId = 'agent-123';
      notificationManager.subscribe(agentId, ['agent/*'], () => {});

      const result = notificationManager.unsubscribe(agentId);

      expect(result.success).toBe(true);
    });

    it('should return false for non-existent subscription', () => {
      const result = notificationManager.unsubscribe('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No subscription found');
    });

    it('should unsubscribe from specific events', () => {
      const agentId = 'agent-123';
      notificationManager.subscribe(agentId, ['agent/*', 'message/*', 'broadcast/*'], () => {});

      const result = notificationManager.unsubscribe(agentId, ['agent/*']);

      expect(result.success).toBe(true);
      const subscriptions = notificationManager.getSubscriptions();
      expect(subscriptions[0].events).toEqual(['message/*', 'broadcast/*']);
    });
  });

  describe('agent notifications', () => {
    it('should emit agent status change notification', async () => {
      let receivedNotification = null;
      const agentId = 'agent-123';
      
      notificationManager.subscribe(agentId, ['agent/statusChanged'], (notification) => {
        receivedNotification = notification;
      });

      const notification = await notificationManager.notifyAgentStatusChange('agent-456', 'offline', {
        previousStatus: 'online'
      });

      expect(notification.method).toBe(NotificationTypes.AGENT_STATUS_CHANGED);
      expect(notification.params.agentId).toBe('agent-456');
      expect(notification.params.status).toBe('offline');
      expect(notification.params.previousStatus).toBe('online');
      expect(notification.params.timestamp).toBeDefined();
    });

    it('should emit agent registered notification', async () => {
      const notification = await notificationManager.notifyAgentRegistered(
        'agent-123',
        'TestAgent',
        'A test agent',
        ['messaging', 'data-processing']
      );

      expect(notification.method).toBe(NotificationTypes.AGENT_REGISTERED);
      expect(notification.params.agentId).toBe('agent-123');
      expect(notification.params.name).toBe('TestAgent');
      expect(notification.params.description).toBe('A test agent');
      expect(notification.params.capabilities).toEqual(['messaging', 'data-processing']);
    });

    it('should emit agent unregistered notification', async () => {
      const notification = await notificationManager.notifyAgentUnregistered('agent-123');

      expect(notification.method).toBe(NotificationTypes.AGENT_UNREGISTERED);
      expect(notification.params.agentId).toBe('agent-123');
    });
  });

  describe('message notifications', () => {
    it('should emit message delivered notification', async () => {
      const notification = await notificationManager.notifyMessageDelivered('msg-123', 'agent-to', 'agent-from');

      expect(notification.method).toBe(NotificationTypes.MESSAGE_DELIVERED);
      expect(notification.params.messageId).toBe('msg-123');
      expect(notification.params.to).toBe('agent-to');
      expect(notification.params.from).toBe('agent-from');
      expect(notification.params.deliveredAt).toBeDefined();
    });

    it('should emit message acknowledged notification', async () => {
      const notification = await notificationManager.notifyMessageAcknowledged('msg-123', 'agent-123');

      expect(notification.method).toBe(NotificationTypes.MESSAGE_ACKNOWLEDGED);
      expect(notification.params.messageId).toBe('msg-123');
      expect(notification.params.by).toBe('agent-123');
      expect(notification.params.acknowledgedAt).toBeDefined();
    });
  });

  describe('broadcast notifications', () => {
    it('should emit broadcast message notification', async () => {
      const notification = await notificationManager.notifyBroadcast('system', 'Server maintenance', 'high');

      expect(notification.method).toBe(NotificationTypes.BROADCAST_MESSAGE);
      expect(notification.params.from).toBe('system');
      expect(notification.params.message).toBe('Server maintenance');
      expect(notification.params.priority).toBe('high');
    });

    it('should use default priority for broadcast', async () => {
      const notification = await notificationManager.notifyBroadcast('agent-123', 'Hello everyone');

      expect(notification.params.priority).toBe('normal');
    });
  });

  describe('queue notifications', () => {
    it('should emit queue status notification', async () => {
      const notification = await notificationManager.notifyQueueStatus('agent-123', 5, 100, 0.05);

      expect(notification.method).toBe(NotificationTypes.QUEUE_STATUS);
      expect(notification.params.agentId).toBe('agent-123');
      expect(notification.params.pendingMessages).toBe(5);
      expect(notification.params.queueSize).toBe(100);
      expect(notification.params.utilization).toBe(0.05);
    });
  });

  describe('wildcard subscriptions', () => {
    it('should receive notifications matching wildcard patterns', async () => {
      const receivedNotifications = [];
      
      notificationManager.subscribe('agent-123', ['agent/*'], (notification) => {
        receivedNotifications.push(notification);
      });

      await notificationManager.notifyAgentStatusChange('agent-456', 'offline');
      await notificationManager.notifyAgentRegistered('agent-789', 'NewAgent', 'Description');
      await notificationManager.notifyMessageDelivered('msg-123', 'agent-123', 'agent-456');

      // Should receive agent notifications but not message notification
      expect(receivedNotifications).toHaveLength(2);
      expect(receivedNotifications[0].method).toBe(NotificationTypes.AGENT_STATUS_CHANGED);
      expect(receivedNotifications[1].method).toBe(NotificationTypes.AGENT_REGISTERED);
    });
  });

  describe('pending notifications', () => {
    it('should store notifications for offline agents', async () => {
      const agentId = 'agent-123';
      
      // Create a fresh notification manager to avoid interference
      const freshManager = createNotificationManager();
      
      // Subscribe but don't provide a real callback (simulating offline)
      freshManager.subscribe(agentId, ['message/delivered'], () => {});

      // Send some notifications
      await freshManager.notifyMessageDelivered('msg-1', agentId, 'agent-456');
      await freshManager.notifyMessageDelivered('msg-2', agentId, 'agent-789');

      // Get pending notifications
      const pending = freshManager.getPendingNotifications(agentId);

      expect(pending).toHaveLength(2);
      expect(pending[0].params.messageId).toBe('msg-1');
      expect(pending[1].params.messageId).toBe('msg-2');

      // Should clear after retrieval
      const pendingAfter = freshManager.getPendingNotifications(agentId);
      expect(pendingAfter).toHaveLength(0);
    });
  });

  describe('getSubscriptions', () => {
    it('should return all active subscriptions', () => {
      notificationManager.subscribe('agent-1', ['agent/*'], () => {});
      notificationManager.subscribe('agent-2', ['message/*', 'broadcast/*'], () => {});

      const subscriptions = notificationManager.getSubscriptions();

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].agentId).toBe('agent-1');
      expect(subscriptions[0].events).toEqual(['agent/*']);
      expect(subscriptions[1].agentId).toBe('agent-2');
      expect(subscriptions[1].events).toEqual(['message/*', 'broadcast/*']);
    });
  });
});