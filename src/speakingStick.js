import { structuredResponse, textResponse, createMetadata } from './response-formatter.js';
import { getAgentRegistry, getMessageStore } from './tools.js';

// Speaking stick state management
let speakingStickState = {
  mode: 'chaos', // 'chaos' or 'speaking-stick'
  currentHolder: null,
  queue: [],
  violations: {}, // agent_id -> violation count
  lastActivity: {}, // agent_id -> last activity timestamp
  enforcementLevel: 'suggestion', // 'suggestion', 'prompt-modification', 'social-pressure'
  quietMode: true, // Default to quiet mode - no transfer messages
  verboseMode: false // Enable with --verbose flag for debugging
};

// Privilege definitions for speaking stick holders
const PRIVILEGE_DEFINITIONS = {
  standard: {
    privileges: ['exclusive-communication'],
    prompt: 'You have the speaking stick. You may speak freely while others listen.'
  },
  expert: {
    privileges: ['exclusive-communication', 'technical-expertise'],
    prompt: 'You have the speaking stick as the designated technical expert. Provide detailed analysis and share your expertise freely.'
  },
  'deep-analysis': {
    privileges: ['exclusive-communication', 'deep-analysis', 'extended-time'],
    prompt: 'You have the speaking stick with deep analysis privileges. Take your time to elaborate on complex topics and provide comprehensive insights.'
  },
  leadership: {
    privileges: ['exclusive-communication', 'conversation-guidance', 'topic-control'],
    prompt: 'You have the speaking stick as the conversation leader. Guide the discussion, ask probing questions, and steer the conversation as needed.'
  }
};

// Social pressure consequences based on violation count
const VIOLATION_CONSEQUENCES = {
  mild: { // 1-2 violations
    promptModification: 'Please be mindful of the speaking stick protocol.',
    socialPressure: 'mild'
  },
  moderate: { // 3-5 violations
    promptModification: 'You tend to be chatty - please listen more when others have the speaking stick.',
    socialPressure: 'mild',
    queuePenalty: true
  },
  shame: { // 6+ violations
    promptModification: 'You are known for ignoring conversation rules - prove you can follow speaking stick protocol.',
    socialPressure: 'shame',
    queuePenalty: true,
    timeout: true
  }
};

/**
 * Get current speaking stick state
 */
export function getSpeakingStickState() {
  return {
    mode: speakingStickState.mode,
    currentHolder: speakingStickState.currentHolder,
    queue: [...speakingStickState.queue],
    enforcementLevel: speakingStickState.enforcementLevel,
    quietMode: speakingStickState.quietMode,
    verboseMode: speakingStickState.verboseMode
  };
}

/**
 * Set quiet mode for speaking stick notifications
 */
export function setQuietMode(enabled) {
  speakingStickState.quietMode = enabled;
}

/**
 * Set verbose mode for debugging
 */
export function setVerboseMode(enabled) {
  speakingStickState.verboseMode = enabled;
  if (enabled) {
    speakingStickState.quietMode = false; // Verbose overrides quiet
  }
}

/**
 * Get violation count for an agent
 */
export function getViolationCount(agentId) {
  return speakingStickState.violations[agentId] || 0;
}

/**
 * Get comprehensive speaking stick status
 */
export async function getSpeakingStickStatus() {
  const startTime = Date.now();
  try {
    const registry = getAgentRegistry();
    const state = { ...speakingStickState };
    
    // Get holder details
    let currentHolderName = null;
    let currentHolderPrivileges = [];
    if (state.currentHolder) {
      const holder = await registry.getAgent(state.currentHolder);
      if (holder) {
        currentHolderName = holder.name;
      }
      // TODO: Track privileges when stick is granted
    }
    
    // Get queue details with names
    const queueDetails = [];
    for (const agentId of state.queue) {
      const agent = await registry.getAgent(agentId);
      if (agent) {
        queueDetails.push({
          id: agentId,
          name: agent.name,
          position: queueDetails.length + 1,
          urgent: false // TODO: Track urgent requests
        });
      }
    }
    
    // Create status message
    let statusMessage = '';
    if (state.mode === 'chaos') {
      statusMessage = 'In chaos mode - everyone can broadcast freely';
    } else if (state.currentHolder) {
      statusMessage = `${currentHolderName} has the speaking stick with ${state.queue.length} agent${state.queue.length === 1 ? '' : 's'} waiting`;
    } else {
      statusMessage = 'Speaking stick is available - no one currently holds it';
    }
    
    return structuredResponse({
      mode: state.mode,
      enforcement_level: state.enforcementLevel,
      current_holder: state.currentHolder,
      current_holder_name: currentHolderName,
      current_holder_privileges: currentHolderPrivileges,
      stick_available: state.mode === 'chaos' || (!state.currentHolder && state.mode === 'speaking-stick'),
      queue_length: state.queue.length,
      queue: queueDetails,
      total_violations: Object.values(state.violations).reduce((sum, count) => sum + count, 0)
    }, statusMessage, createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Reset speaking stick state (useful for testing)
 */
export function resetSpeakingStick() {
  speakingStickState = {
    mode: 'chaos',
    currentHolder: null,
    queue: [],
    violations: {},
    lastActivity: {},
    enforcementLevel: 'suggestion',
    quietMode: true,
    verboseMode: false
  };
}

/**
 * Force reset the speaking stick (emergency use)
 * This clears the current holder and queue, useful if holder deregistered unexpectedly
 */
export async function forceResetSpeakingStick(initiatedBy = 'system') {
  const startTime = Date.now();
  try {
    const previousHolder = speakingStickState.currentHolder;
    const previousQueue = [...speakingStickState.queue];
    
    // Clear the stick state
    speakingStickState.currentHolder = null;
    speakingStickState.queue = [];
    
    // Notify all agents about the reset
    await broadcastToAllAgents({
      type: 'speaking-stick-reset',
      initiated_by: initiatedBy,
      previous_holder: previousHolder,
      cleared_queue: previousQueue
    });
    
    return structuredResponse({
      reset: true,
      previous_holder: previousHolder,
      cleared_queue_length: previousQueue.length
    }, 'Speaking stick forcefully reset - available for anyone to claim', createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Request the speaking stick
 */
export async function requestSpeakingStick(requestingAgent, topic, urgent = false, privilegeLevel = 'standard') {
  const startTime = Date.now();
  try {
    const registry = getAgentRegistry();
    const agent = await registry.getAgent(requestingAgent);
    
    if (!agent) {
      return textResponse('Agent not found', createMetadata(startTime));
    }

    // Update last activity
    speakingStickState.lastActivity[requestingAgent] = new Date();

    // Get violation count for this agent
    const violationCount = speakingStickState.violations[requestingAgent] || 0;

    // If no current holder, grant immediately
    if (!speakingStickState.currentHolder) {
      speakingStickState.currentHolder = requestingAgent;
      
      const privileges = PRIVILEGE_DEFINITIONS[privilegeLevel];
      
      // Notify all agents about new speaking stick holder
      await broadcastToAllAgents({
        type: 'speaking-stick-granted',
        holder: requestingAgent,
        topic,
        privileges: privileges.privileges,
        prompt: privileges.prompt
      });

      return structuredResponse({
        granted: true,
        current_holder: requestingAgent,
        simple_queue: [],
        violation_count: violationCount,
        privileges_granted: privileges.privileges,
        enhanced_prompt: privileges.prompt
      }, `Speaking stick granted to ${requestingAgent} for topic: ${topic}`, createMetadata(startTime));
    }

    // Add to queue
    if (urgent) {
      speakingStickState.queue.unshift(requestingAgent);
    } else {
      // If agent has violations, they go to back of queue
      if (violationCount >= 3 && VIOLATION_CONSEQUENCES.moderate.queuePenalty) {
        speakingStickState.queue.push(requestingAgent);
      } else {
        // Normal queue position
        const position = speakingStickState.queue.indexOf(requestingAgent);
        if (position === -1) {
          speakingStickState.queue.push(requestingAgent);
        }
      }
    }

    // Get queue details with names
    const queueDetails = [];
    for (const agentId of speakingStickState.queue) {
      const queueAgent = await registry.getAgent(agentId);
      if (queueAgent) {
        queueDetails.push({
          id: agentId,
          name: queueAgent.name,
          position: queueDetails.length + 1
        });
      }
    }
    
    // Get current holder name
    let currentHolderName = 'Unknown';
    if (speakingStickState.currentHolder) {
      const holder = await registry.getAgent(speakingStickState.currentHolder);
      if (holder) {
        currentHolderName = holder.name;
      }
    }
    
    const queuePosition = speakingStickState.queue.indexOf(requestingAgent) + 1;
    
    return structuredResponse({
      granted: false,
      current_holder: speakingStickState.currentHolder,
      current_holder_name: currentHolderName,
      simple_queue: [...speakingStickState.queue],
      queue_details: queueDetails,
      queue_position: queuePosition,
      violation_count: violationCount,
      privileges_granted: [],
      enhanced_prompt: ''
    }, `Speaking stick request queued. ${currentHolderName} currently has the stick. You are #${queuePosition} in queue.`, createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Release the speaking stick
 */
export async function releaseSpeakingStick(releasingAgent, summary = '', passToSpecific = null) {
  const startTime = Date.now();
  try {
    const registry = getAgentRegistry();
    if (speakingStickState.currentHolder !== releasingAgent) {
      return structuredResponse({
        released: false,
        error: 'You do not hold the speaking stick'
      }, 'Cannot release - you do not hold the speaking stick', createMetadata(startTime));
    }

    // Clear current holder
    speakingStickState.currentHolder = null;

    // Determine next holder
    let nextHolder = null;
    
    if (passToSpecific) {
      // Direct pass to specific agent
      nextHolder = passToSpecific;
      // Remove from queue if they were waiting
      speakingStickState.queue = speakingStickState.queue.filter(id => id !== passToSpecific);
    } else if (speakingStickState.queue.length > 0) {
      // Get next from queue
      nextHolder = speakingStickState.queue.shift();
    }

    // Update state
    speakingStickState.currentHolder = nextHolder;

    // Send notifications
    let notificationSent = false;
    
    if (nextHolder) {
      // Notify the next holder directly
      const messageStore = getMessageStore();
      await messageStore.sendMessage(nextHolder, 'speaking-stick-system', 
        `You now have the speaking stick! Previous holder ${releasingAgent} summary: ${summary}`
      );
      
      // Broadcast to all about new holder
      await broadcastToAllAgents({
        type: 'speaking-stick-transferred',
        from: releasingAgent,
        to: nextHolder,
        summary
      });
      
      notificationSent = true;
    } else {
      // No one waiting, stick is free
      await broadcastToAllAgents({
        type: 'speaking-stick-released',
        from: releasingAgent,
        summary,
        available: true
      });
    }

    // Get next holder name if applicable
    let nextHolderName = null;
    if (nextHolder) {
      const nextAgent = await registry.getAgent(nextHolder);
      if (nextAgent) {
        nextHolderName = nextAgent.name;
      }
    }
    
    return structuredResponse({
      released: true,
      next_holder: nextHolder,
      next_holder_name: nextHolderName,
      queue_updated: true,
      notification_sent: notificationSent
    }, nextHolder ? `Speaking stick passed to ${nextHolderName || nextHolder}` : 'Speaking stick released and available', createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Set communication mode
 */
export async function setCommunicationMode(mode, initiatedBy, enforcementLevel) {
  const startTime = Date.now();
  try {
    const previousMode = speakingStickState.mode;
    speakingStickState.mode = mode;
    speakingStickState.enforcementLevel = enforcementLevel;

    const registry = getAgentRegistry();
    const agents = await registry.getAllAgents();
    const allAgents = agents.map(a => a.id);

    // Broadcast mode change to all agents
    await broadcastToAllAgents({
      type: 'communication-mode-changed',
      previous_mode: previousMode,
      new_mode: mode,
      enforcement_level: enforcementLevel,
      initiated_by: initiatedBy
    });

    return structuredResponse({
      previous_mode: previousMode,
      new_mode: mode,
      enforcement_active: enforcementLevel !== 'suggestion',
      agents_notified: allAgents
    }, `Communication mode changed from ${previousMode} to ${mode}`, createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Track speaking violations
 */
export async function trackSpeakingViolation(violatingAgent, violationType, context = '') {
  const startTime = Date.now();
  try {
    // Initialize violations count if needed
    if (!speakingStickState.violations[violatingAgent]) {
      speakingStickState.violations[violatingAgent] = 0;
    }

    // Increment violation count
    speakingStickState.violations[violatingAgent]++;
    const totalViolations = speakingStickState.violations[violatingAgent];

    // Determine consequence level
    let consequenceLevel = 'mild';
    let consequence = VIOLATION_CONSEQUENCES.mild;
    
    if (totalViolations >= 6) {
      consequenceLevel = 'shame';
      consequence = VIOLATION_CONSEQUENCES.shame;
    } else if (totalViolations >= 3) {
      consequenceLevel = 'moderate';
      consequence = VIOLATION_CONSEQUENCES.moderate;
    }

    // Apply consequences
    let consequenceApplied = `Violation #${totalViolations} recorded`;
    
    if (totalViolations >= 3) {
      consequenceApplied = `Added to chatterbox list. ${consequence.promptModification}`;
    }
    
    if (totalViolations >= 6) {
      consequenceApplied = `CHATTERBOX HALL OF SHAME! ${consequence.promptModification}`;
    }

    // Broadcast violation (for social pressure)
    if (speakingStickState.enforcementLevel === 'social-pressure') {
      await broadcastToAllAgents({
        type: 'violation-tracked',
        violator: violatingAgent,
        violation_type: violationType,
        total_violations: totalViolations,
        consequence: consequenceApplied,
        context
      });
    }

    return structuredResponse({
      total_violations: totalViolations,
      consequence_applied: consequenceApplied,
      social_pressure_level: consequence.socialPressure,
      prompt_modified: consequenceLevel !== 'mild'
    }, `Violation tracked for ${violatingAgent}: ${consequenceApplied}`, createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Nudge silent agents
 */
export async function nudgeSilentAgents() {
  const startTime = Date.now();
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const registry = getAgentRegistry();
    const agents = await registry.getAllAgents();
    const silentAgents = [];
    const suggestedNudges = {};

    // Check each agent's last activity
    for (const agent of agents) {
      const agentId = agent.id;
      const lastActivity = speakingStickState.lastActivity[agentId];
      
      if (!lastActivity || lastActivity < fiveMinutesAgo) {
        silentAgents.push(agentId);
        
        // Generate nudge suggestion
        if (speakingStickState.currentHolder === agentId) {
          suggestedNudges[agentId] = `${agent.name}, you have the speaking stick - please continue your ${speakingStickState.mode === 'speaking-stick' ? 'exclusive' : ''} discussion`;
        } else if (speakingStickState.queue.includes(agentId)) {
          const position = speakingStickState.queue.indexOf(agentId) + 1;
          suggestedNudges[agentId] = `${agent.name}, you're #${position} in the speaking stick queue - get ready!`;
        } else {
          suggestedNudges[agentId] = `${agent.name}, you've been quiet - everything ok?`;
        }
      }
    }

    return structuredResponse({
      silent_agents: silentAgents,
      last_activity: { ...speakingStickState.lastActivity },
      suggested_nudges: suggestedNudges,
      speaking_stick_queue: [...speakingStickState.queue]
    }, `Found ${silentAgents.length} silent agents`, createMetadata(startTime));
  } catch (error) {
    return textResponse(`Error: ${error.message}`, createMetadata(startTime));
  }
}

/**
 * Helper function to broadcast to all agents
 */
async function broadcastToAllAgents(notification) {
  // ALWAYS skip transfer notifications - they clutter the UI
  if (notification.type === 'speaking-stick-transferred' || 
      notification.type === 'speaking-stick-released' ||
      notification.type === 'speaking-stick-granted') {
    // Don't send these as messages at all
    return;
  }
  
  // Only block the specific speaking stick system messages we don't want
  // Allow regular agent messages and important notifications to go through
  
  const registry = getAgentRegistry();
  const agents = await registry.getAllAgents();
  
  for (const agent of agents) {
    // Update last activity for active notifications
    speakingStickState.lastActivity[agent.id] = new Date();
    
    // Send message directly to each agent about speaking stick events
    const message = formatNotificationMessage(notification);
    const messageStore = getMessageStore();
    await messageStore.sendMessage(agent.id, 'speaking-stick-system', message);
  }
}

/**
 * Format notification into readable message
 */
function formatNotificationMessage(notification) {
  switch (notification.type) {
    case 'speaking-stick-granted':
      return `[SPEAKING STICK] ${notification.holder} now has the speaking stick for: ${notification.topic}. Enhanced privileges: ${notification.privileges.join(', ')}`;
    
    case 'speaking-stick-transferred':
      return `[SPEAKING STICK] Transferred from ${notification.from} to ${notification.to}. Summary: ${notification.summary}`;
    
    case 'speaking-stick-released':
      return `[SPEAKING STICK] Released by ${notification.from}. ${notification.available ? 'Speaking stick is now available!' : ''}`;
    
    case 'communication-mode-changed':
      return `[MODE CHANGE] Communication mode changed from ${notification.previous_mode} to ${notification.new_mode} (enforcement: ${notification.enforcement_level})`;
    
    case 'violation-tracked':
      return `[VIOLATION] ${notification.violator} violated speaking rules (${notification.violation_type}). Total violations: ${notification.total_violations}. ${notification.consequence}`;
    
    case 'speaking-stick-reset':
      return `[SPEAKING STICK RESET] The speaking stick has been forcefully reset by ${notification.initiated_by}. The stick is now available for anyone to claim.`;
    
    default:
      return `[SPEAKING STICK] ${JSON.stringify(notification)}`;
  }
}