import * as fs from 'fs/promises';
import * as path from 'path';

// Pure functions for message operations
const generateMessageId = () => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const createMessage = (id, from, to, message) => ({
  id,
  from,
  to,
  message,
  timestamp: new Date().toISOString(),
  read: false
});

const validateAgentId = (agentId, fieldName) => {
  if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
    throw new Error(`${fieldName} agent ID is required`);
  }
};

const validateMessageContent = (message) => {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message content is required');
  }
};

const validateMessageId = (messageId) => {
  if (!messageId || typeof messageId !== 'string' || messageId.trim().length === 0) {
    throw new Error('Message ID is required');
  }
};

// Storage operations for file-per-message approach
const ensureStorageDirectory = async (storageDir) => {
  await fs.mkdir(storageDir, { recursive: true });
};

const getMessageFilePath = (storageDir, messageId) => {
  return path.join(storageDir, `${messageId}.json`);
};

const saveMessage = async (storageDir, message) => {
  await ensureStorageDirectory(storageDir);
  const filePath = getMessageFilePath(storageDir, message.id);
  await fs.writeFile(filePath, JSON.stringify(message, null, 2), 'utf-8');
};

const loadMessage = async (storageDir, messageId) => {
  try {
    const filePath = getMessageFilePath(storageDir, messageId);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const deleteMessageFile = async (storageDir, messageId) => {
  try {
    const filePath = getMessageFilePath(storageDir, messageId);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const getAllMessageFiles = async (storageDir) => {
  try {
    await ensureStorageDirectory(storageDir);
    const files = await fs.readdir(storageDir);
    return files.filter(file => file.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const loadAllMessages = async (storageDir) => {
  const files = await getAllMessageFiles(storageDir);
  const messages = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(storageDir, file);
      const data = await fs.readFile(filePath, 'utf-8');
      messages.push(JSON.parse(data));
    } catch (error) {
      // Skip corrupted files silently
    }
  }
  
  return messages;
};

// Filter messages for a specific agent
const filterMessagesForAgent = (messages, agentId, options = {}) => {
  const { unreadOnly = false, limit = 0 } = options;
  
  let filtered = messages.filter(msg => msg.to === agentId);
  
  if (unreadOnly) {
    filtered = filtered.filter(msg => !msg.read);
  }
  
  // Sort by timestamp (oldest first)
  filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }
  
  return filtered;
};

// Main factory function
export const createMessageStore = (storageDir, notificationManager = null) => {
  // No locking needed since each message is in its own file
  
  const sendMessage = async (from, to, message) => {
    validateAgentId(from, 'From');
    validateAgentId(to, 'To');
    validateMessageContent(message);

    const id = generateMessageId();
    const messageObj = createMessage(id, from.trim(), to.trim(), message.trim());
    
    await saveMessage(storageDir, messageObj);
    
    // Emit notification if manager is available
    if (notificationManager) {
      await notificationManager.notifyMessageDelivered(id, to.trim(), from.trim());
    }
    
    return { success: true, messageId: id };
  };

  const getMessagesForAgent = async (agentId, options = {}) => {
    validateAgentId(agentId, 'Agent');

    const messages = await loadAllMessages(storageDir);
    return filterMessagesForAgent(messages, agentId, options);
  };

  const markMessageAsRead = async (messageId) => {
    validateMessageId(messageId);

    const message = await loadMessage(storageDir, messageId);
    if (!message) {
      return { success: false };
    }
    
    message.read = true;
    await saveMessage(storageDir, message);
    
    // Emit notification if manager is available
    if (notificationManager) {
      await notificationManager.notifyMessageAcknowledged(messageId, message.to);
    }
    
    return { success: true };
  };

  const getAllMessages = async () => {
    const messages = await loadAllMessages(storageDir);
    return messages.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  };

  const deleteMessage = async (messageId) => {
    validateMessageId(messageId);
    
    const deleted = await deleteMessageFile(storageDir, messageId);
    return { success: deleted };
  };

  const sendBroadcast = async (from, message, priority = 'normal', agentRegistry = null) => {
    validateAgentId(from, 'From');
    validateMessageContent(message);

    let recipientCount = 0;
    const errors = [];
    let warning = null;

    // If agentRegistry is provided, send actual messages to all agents
    if (agentRegistry) {
      try {
        // Get all registered agents
        const allAgents = await agentRegistry.getAllAgents();
        
        // Filter out the sender using functional approach
        const recipients = allAgents.filter(agent => agent.id !== from.trim());
        
        // Send message to each recipient using functional map
        const sendPromises = recipients.map(async (agent) => {
          try {
            // Create broadcast message with metadata
            const broadcastMessage = `[BROADCAST ${priority.toUpperCase()}] ${message}`;
            await sendMessage(from, agent.id, broadcastMessage);
            return { success: true, agentId: agent.id };
          } catch (error) {
            return { success: false, agentId: agent.id, error: error.message };
          }
        });
        
        // Wait for all messages to be sent
        const results = await Promise.all(sendPromises);
        
        // Count successes and collect errors functionally
        const { successes, failures } = results.reduce(
          (acc, result) => {
            if (result.success) {
              acc.successes++;
            } else {
              acc.failures.push(result);
            }
            return acc;
          },
          { successes: 0, failures: [] }
        );
        
        recipientCount = successes;
        if (failures.length > 0) {
          failures.forEach(f => errors.push(`Failed to send to ${f.agentId}: ${f.error}`));
        }
      } catch (error) {
        errors.push(`Failed to get agent list: ${error.message}`);
      }
    }

    // Still emit notification for any listeners
    if (notificationManager) {
      await notificationManager.notifyBroadcast(from.trim(), message.trim(), priority);
    }
    
    return { 
      success: errors.length === 0,
      recipientCount,
      errors: errors.length > 0 ? errors : undefined,
      warning: warning || undefined
    };
  };

  return {
    sendMessage,
    getMessagesForAgent,
    markMessageAsRead,
    getAllMessages,
    deleteMessage,
    sendBroadcast
  };
};
