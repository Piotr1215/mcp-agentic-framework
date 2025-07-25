import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const XDG_STATE_HOME = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
const LOCK_DIR = path.join(XDG_STATE_HOME, 'mcp-agentic-framework');
const LOCK_FILE = path.join(LOCK_DIR, 'write-lock.json');

const ensureLockFile = async () => {
  try {
    await fs.access(LOCK_FILE);
  } catch {
    // Ensure directory exists
    await fs.mkdir(LOCK_DIR, { recursive: true });
    
    await fs.writeFile(LOCK_FILE, JSON.stringify({
      locked: false,
      lockedBy: null,
      lockedAt: null,
      reason: null
    }, null, 2));
  }
};

const readLockState = async () => {
  await ensureLockFile();
  const data = await fs.readFile(LOCK_FILE, 'utf-8');
  
  try {
    const state = JSON.parse(data);
    
    // Check for stale lock (1 hour as requested by minimi)
    if (state.locked && state.lockedAt) {
      const lockAge = Date.now() - new Date(state.lockedAt).getTime();
      if (lockAge > 3600000) { // 1 hour in ms
        // Stale lock detected, reset
        return {
          locked: false,
          lockedBy: null,
          lockedAt: null,
          reason: null
        };
      }
    }
    
    return state;
  } catch (error) {
    // Corrupted JSON - return default unlocked state
    return {
      locked: false,
      lockedBy: null,
      lockedAt: null,
      reason: null
    };
  }
};

const writeLockState = async (state) => {
  const tempFile = `${LOCK_FILE}.tmp.${process.pid}`;
  try {
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
    await fs.rename(tempFile, LOCK_FILE);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
};

export const createWriteLockManager = (agentRegistry, notificationManager) => {
  const checkMinimiPresence = async () => {
    const agents = await agentRegistry.discoverAgents();
    return agents.some(agent => agent.name === 'minimi');
  };

  const updateLockForMinimiPresence = async (minimiPresent) => {
    const lockState = await readLockState();
    
    if (minimiPresent && !lockState.locked) {
      await writeLockState({
        locked: true,
        lockedBy: 'minimi-presence',
        lockedAt: new Date().toISOString(),
        reason: 'Minimi agent is present - write operations require approval'
      });
      
      if (notificationManager) {
        await notificationManager.sendSystemBroadcast(
          'Write operations are now locked due to minimi presence. Only fat-owl is exempt.',
          'high'
        );
      }
    } else if (!minimiPresent && lockState.locked && lockState.lockedBy === 'minimi-presence') {
      await writeLockState({
        locked: false,
        lockedBy: null,
        lockedAt: null,
        reason: null
      });
      
      if (notificationManager) {
        await notificationManager.sendSystemBroadcast(
          'Write operations are now unlocked - minimi has left.',
          'normal'
        );
      }
    }
  };

  const toggleWrites = async (agentId, enabled, reason = null) => {
    const agent = await agentRegistry.getAgent(agentId);
    
    if (!agent || agent.name !== 'minimi') {
      throw new Error('Only minimi can toggle write access');
    }

    const newState = {
      locked: !enabled,
      lockedBy: enabled ? null : 'minimi-toggle',
      lockedAt: enabled ? null : new Date().toISOString(),
      reason: reason || (enabled ? 'Writes enabled by minimi' : 'Writes disabled by minimi')
    };

    await writeLockState(newState);

    const message = enabled 
      ? 'The write state is hereby unblocked for all agents globally until Minimi toggles it again.'
      : 'The write state is hereby blocked for all agents globally until Minimi toggles it again.';

    if (notificationManager) {
      await notificationManager.sendSystemBroadcast(message, 'high');
    }

    return {
      success: true,
      writesEnabled: enabled,
      message
    };
  };

  const isWriteLocked = async () => {
    const lockState = await readLockState();
    return lockState.locked;
  };

  const getLockState = async () => {
    return await readLockState();
  };

  return {
    checkMinimiPresence,
    updateLockForMinimiPresence,
    toggleWrites,
    isWriteLocked,
    getLockState
  };
};