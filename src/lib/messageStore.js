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
export const createMessageStore = (storageDir, notificationManager = null, speakingStickGetter = null) => {
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

    // Check speaking stick enforcement
    if (speakingStickGetter) {
      const stickState = speakingStickGetter();
      
      // If in speaking-stick mode with enforcement
      if (stickState.mode === 'speaking-stick' && 
          stickState.enforcementLevel !== 'suggestion') {
        
        // Check if sender has the stick
        if (stickState.currentHolder !== from.trim()) {
          // Track violation
          let totalViolations = 1;
          if (notificationManager && notificationManager.trackViolation) {
            const violationResult = await notificationManager.trackViolation(from.trim(), 'spoke-without-stick');
            totalViolations = notificationManager.getViolationCount(from.trim());
          }
          
          // Get current holder name and queue info for enhanced error messages
          let currentHolderName = null;
          let queueLength = stickState.queue.length;
          
          if (stickState.currentHolder && agentRegistry) {
            try {
              const agents = await agentRegistry.getAllAgents();
              const holder = agents.find(a => a.id === stickState.currentHolder);
              if (holder) {
                currentHolderName = holder.name;
              }
            } catch (e) {
              // Silent fail
            }
          }
          
          // Determine error message and additional info
          let errorMessage = 'ERROR: Broadcast not sent. Request speaking stick first.';
          let suggestion = null;
          
          if (!stickState.currentHolder) {
            errorMessage = 'ERROR: Broadcast not sent. No one holds the speaking stick.';
            suggestion = 'Request it first with request-speaking-stick.';
          } else if (currentHolderName) {
            // Enhanced error message with holder name and queue info
            errorMessage = `ERROR: Broadcast not sent. ${currentHolderName} currently has the stick`;
            if (queueLength > 0) {
              errorMessage += ` with ${queueLength} agent${queueLength === 1 ? '' : 's'} waiting.`;
              const queuePos = stickState.queue.indexOf(from.trim()) + 1;
              if (queuePos > 0) {
                suggestion = `You are #${queuePos} in the queue.`;
              } else {
                suggestion = `Request the stick to join the queue (you would be #${queueLength + 1}).`;
              }
            } else {
              errorMessage += '.';
              suggestion = 'Request the stick to speak next.';
            }
          }
          
          // Check if we need to broadcast violation
          let violationBroadcast = false;
          let notifiedAgents = [];
          
          if (stickState.enforcementLevel === 'social-pressure' && agentRegistry) {
            try {
              const allAgents = await agentRegistry.getAllAgents();
              notifiedAgents = allAgents.filter(a => a.id !== from.trim()).map(a => a.id);
              violationBroadcast = true;
            } catch (e) {
              // Silent fail on broadcast
            }
          }
          
          // Calculate social pressure level
          let socialPressureLevel = 'mild';
          if (totalViolations >= 6) {
            socialPressureLevel = 'shame';
          } else if (totalViolations >= 3) {
            socialPressureLevel = 'moderate';
          }
          
          // Determine consequence text
          let consequence = `Violation #${totalViolations} recorded`;
          if (totalViolations >= 6) {
            consequence = `CHATTERBOX HALL OF SHAME!`;
          } else if (totalViolations >= 3) {
            consequence = `Added to chatterbox list.`;
          }
          
          // Return error
          return {
            success: false,
            recipientCount: 0,
            error: errorMessage,
            currentHolder: stickState.currentHolder,
            currentHolderName: currentHolderName || undefined,
            queueLength: queueLength,
            queuePosition: stickState.queue.indexOf(from.trim()) >= 0 ? stickState.queue.indexOf(from.trim()) + 1 : undefined,
            violationTracked: true,
            totalViolations: totalViolations,
            socialPressureLevel: socialPressureLevel,
            consequence: consequence,
            suggestion: suggestion || undefined,
            violationBroadcast: violationBroadcast,
            notifiedAgents: notifiedAgents.length > 0 ? notifiedAgents : undefined
          };
        }
      } else if (stickState.mode === 'speaking-stick' && 
                 stickState.enforcementLevel === 'suggestion') {
        // Just add a warning but allow broadcast
        if (stickState.currentHolder !== from.trim()) {
          // Continue with normal broadcast but add warning
          // Will be added to the response below
        }
      }
    }

    let recipientCount = 0;
    const errors = [];
    let warning = null;

    // Check if we should add a warning for suggestion mode
    if (speakingStickGetter) {
      const stickState = speakingStickGetter();
      if (stickState.mode === 'speaking-stick' && 
          stickState.enforcementLevel === 'suggestion' &&
          stickState.currentHolder !== from.trim()) {
        warning = 'suggestion: You are broadcasting without the speaking stick';
      }
    }

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