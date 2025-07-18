import EventEmitter from 'events';

// Notification types
export const NotificationTypes = {
  AGENT_STATUS_CHANGED: 'agent/statusChanged',
  AGENT_REGISTERED: 'agent/registered',
  AGENT_UNREGISTERED: 'agent/unregistered',
  MESSAGE_DELIVERED: 'message/delivered',
  MESSAGE_ACKNOWLEDGED: 'message/acknowledged',
  BROADCAST_MESSAGE: 'broadcast/message',
  QUEUE_STATUS: 'queue/status'
};

// Agent status types
export const AgentStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  AWAY: 'away'
};

// Create notification
const createNotification = (method, params) => ({
  jsonrpc: '2.0',
  method,
  params: {
    ...params,
    timestamp: new Date().toISOString()
  }
});

// Subscription management
const createSubscription = (agentId, events, callback) => ({
  agentId,
  events,
  callback,
  subscribedAt: new Date().toISOString()
});

// Main factory function
export const createNotificationManager = (pushNotificationSender = null) => {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0); // Unlimited listeners since we manage them properly
  const subscriptions = new Map(); // agentId -> subscription
  
  // Function to send push notifications
  let sendPushNotification = pushNotificationSender || (() => Promise.resolve());

  // Subscribe to notifications
  const subscribe = (agentId, events, callback) => {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('Agent ID is required');
    }
    
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Events array is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // If agent already has subscription, unsubscribe first
    if (subscriptions.has(agentId)) {
      unsubscribe(agentId);
    }

    // Create listener functions that we can track
    const listeners = new Map();
    
    events.forEach(event => {
      const eventPattern = event.replace('*', '');
      const listener = (notification) => {
        // Check if this notification matches the subscription pattern
        if (event.includes('*')) {
          if (notification.method.startsWith(eventPattern)) {
            callback(notification);
          }
        } else if (notification.method === event) {
          callback(notification);
        }
      };
      listeners.set(event, listener);
      emitter.on(event, listener);
    });

    const subscription = createSubscription(agentId, events, callback);
    subscription.listeners = listeners; // Store listeners for cleanup
    subscriptions.set(agentId, subscription);

    return { success: true };
  };

  // Unsubscribe from notifications
  const unsubscribe = (agentId, events = null) => {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('Agent ID is required');
    }

    const subscription = subscriptions.get(agentId);
    if (!subscription) {
      return { success: false, message: 'No subscription found' };
    }

    if (events && events.length > 0) {
      // Unsubscribe from specific events
      events.forEach(event => {
        const listener = subscription.listeners?.get(event);
        if (listener) {
          emitter.removeListener(event, listener);
          subscription.listeners.delete(event);
        }
      });
      
      // Update subscription events
      subscription.events = subscription.events.filter(e => !events.includes(e));
      
      if (subscription.events.length === 0) {
        // No events left, remove subscription entirely
        subscriptions.delete(agentId);
      }
    } else {
      // Unsubscribe from all events
      if (subscription.listeners) {
        subscription.listeners.forEach((listener, event) => {
          emitter.removeListener(event, listener);
        });
      }
      subscriptions.delete(agentId);
    }

    return { success: true };
  };

  // Emit agent status change
  const notifyAgentStatusChange = async (agentId, status, metadata = {}) => {
    const notification = createNotification(NotificationTypes.AGENT_STATUS_CHANGED, {
      agentId,
      status,
      ...metadata
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.AGENT_STATUS_CHANGED, notification.params);
    
    emitter.emit(NotificationTypes.AGENT_STATUS_CHANGED, notification);
    emitter.emit('agent/*', notification);
    return notification;
  };

  // Emit agent registration
  const notifyAgentRegistered = async (agentId, name, description, capabilities = []) => {
    const notification = createNotification(NotificationTypes.AGENT_REGISTERED, {
      agentId,
      name,
      description,
      capabilities
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.AGENT_REGISTERED, notification.params);
    
    // Also emit locally for any local handlers
    emitter.emit(NotificationTypes.AGENT_REGISTERED, notification);
    emitter.emit('agent/*', notification);
    return notification;
  };

  // Emit agent unregistration
  const notifyAgentUnregistered = async (agentId) => {
    const notification = createNotification(NotificationTypes.AGENT_UNREGISTERED, {
      agentId
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.AGENT_UNREGISTERED, notification.params);
    
    emitter.emit(NotificationTypes.AGENT_UNREGISTERED, notification);
    emitter.emit('agent/*', notification);
    return notification;
  };

  // Emit message delivered
  const notifyMessageDelivered = async (messageId, to, from) => {
    const notification = createNotification(NotificationTypes.MESSAGE_DELIVERED, {
      messageId,
      to,
      from,
      deliveredAt: new Date().toISOString()
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.MESSAGE_DELIVERED, notification.params);
    
    emitter.emit(NotificationTypes.MESSAGE_DELIVERED, notification);
    emitter.emit('message/*', notification);
    return notification;
  };

  // Emit message acknowledged
  const notifyMessageAcknowledged = async (messageId, by) => {
    const notification = createNotification(NotificationTypes.MESSAGE_ACKNOWLEDGED, {
      messageId,
      by,
      acknowledgedAt: new Date().toISOString()
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.MESSAGE_ACKNOWLEDGED, notification.params);
    
    emitter.emit(NotificationTypes.MESSAGE_ACKNOWLEDGED, notification);
    emitter.emit('message/*', notification);
    return notification;
  };

  // Emit broadcast message
  const notifyBroadcast = async (from, message, priority = 'normal') => {
    const notification = createNotification(NotificationTypes.BROADCAST_MESSAGE, {
      from,
      message,
      priority
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.BROADCAST_MESSAGE, notification.params);
    
    emitter.emit(NotificationTypes.BROADCAST_MESSAGE, notification);
    emitter.emit('broadcast/*', notification);
    return notification;
  };

  // Emit system broadcast message (used by framework internals)
  const sendSystemBroadcast = async (message, priority = 'normal') => {
    const notification = createNotification(NotificationTypes.BROADCAST_MESSAGE, {
      from: 'system',
      message,
      priority,
      isSystemMessage: true
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.BROADCAST_MESSAGE, notification.params);
    
    emitter.emit(NotificationTypes.BROADCAST_MESSAGE, notification);
    emitter.emit('broadcast/*', notification);
    return notification;
  };

  // Emit queue status
  const notifyQueueStatus = async (agentId, pendingMessages, queueSize, utilization) => {
    const notification = createNotification(NotificationTypes.QUEUE_STATUS, {
      agentId,
      pendingMessages,
      queueSize,
      utilization
    });
    
    // Send push notification to connected clients
    await sendPushNotification(NotificationTypes.QUEUE_STATUS, notification.params);
    
    emitter.emit(NotificationTypes.QUEUE_STATUS, notification);
    emitter.emit('queue/*', notification);
    return notification;
  };

  // Get active subscriptions
  const getSubscriptions = () => {
    const subs = [];
    subscriptions.forEach((sub, agentId) => {
      subs.push({
        agentId,
        events: sub.events,
        subscribedAt: sub.subscribedAt
      });
    });
    return subs;
  };

  // Get pending notifications for an agent (used for webhooks/polling)
  const pendingNotifications = new Map(); // agentId -> notifications[]

  const storePendingNotification = (agentId, notification) => {
    if (!pendingNotifications.has(agentId)) {
      pendingNotifications.set(agentId, []);
    }
    pendingNotifications.get(agentId).push(notification);
  };

  const getPendingNotifications = (agentId) => {
    const notifications = pendingNotifications.get(agentId) || [];
    pendingNotifications.delete(agentId); // Clear after retrieval
    return notifications;
  };

  // Track which notifications have been stored to avoid duplicates
  const notificationTracker = new WeakMap();
  
  // Override emit to store notifications for offline agents
  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = (event, notification) => {
    // Initialize tracking for this notification if not exists
    if (!notificationTracker.has(notification)) {
      notificationTracker.set(notification, new Set());
    }
    const storedFor = notificationTracker.get(notification);
    
    // Store for offline agents
    subscriptions.forEach((sub, agentId) => {
      // Skip if already stored for this agent
      if (storedFor.has(agentId)) {
        return;
      }
      
      if (sub.events.includes(event) || 
          sub.events.some(e => e.includes('*') && event.startsWith(e.replace('*', '')))) {
        storePendingNotification(agentId, notification);
        storedFor.add(agentId);
      }
    });
    
    return originalEmit(event, notification);
  };

  // Method to set push notification sender after initialization
  const setPushNotificationSender = (sender) => {
    if (sender && typeof sender === 'function') {
      sendPushNotification = sender;
    }
  };

  return {
    subscribe,
    unsubscribe,
    notifyAgentStatusChange,
    notifyAgentRegistered,
    notifyAgentUnregistered,
    notifyMessageDelivered,
    notifyMessageAcknowledged,
    notifyBroadcast,
    sendSystemBroadcast,
    notifyQueueStatus,
    getSubscriptions,
    getPendingNotifications,
    setPushNotificationSender,
    NotificationTypes,
    AgentStatus
  };
};