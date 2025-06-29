import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pure functions for agent operations
const generateId = () => {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const createAgent = (id, name, description, status = '👋 Just joined!') => ({
  id,
  name,
  description,
  status,
  registeredAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString()
});

const validateAgentName = (name) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Agent name is required');
  }
};

const validateAgentDescription = (description) => {
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new Error('Agent description is required');
  }
};

const validateAgentId = (id) => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Agent id is required');
  }
};

// Storage operations
const ensureStorageDirectory = async (storagePath) => {
  const dir = path.dirname(storagePath);
  await fs.mkdir(dir, { recursive: true });
};

const loadAgents = async (storagePath) => {
  try {
    const data = await fs.readFile(storagePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is corrupted
    return {};
  }
};

const saveAgents = async (storagePath, agents) => {
  await ensureStorageDirectory(storagePath);
  await fs.writeFile(storagePath, JSON.stringify(agents, null, 2), 'utf-8');
};

// Lock mechanism for concurrent operations
const createLock = () => {
  let isLocked = false;
  const queue = [];

  const acquire = async () => {
    if (!isLocked) {
      isLocked = true;
      return;
    }

    return new Promise((resolve) => {
      queue.push(resolve);
    });
  };

  const release = () => {
    if (queue.length > 0) {
      const resolve = queue.shift();
      resolve();
    } else {
      isLocked = false;
    }
  };

  return { acquire, release };
};

// Main factory function
export const createAgentRegistry = (storagePath, notificationManager = null) => {
  const lock = createLock();

  const withLock = async (operation) => {
    await lock.acquire();
    try {
      return await operation();
    } finally {
      lock.release();
    }
  };

  const registerAgent = async (name, description) => {
    validateAgentName(name);
    validateAgentDescription(description);

    return withLock(async () => {
      const agents = await loadAgents(storagePath);
      const id = generateId();
      const agent = createAgent(id, name.trim(), description.trim());
      
      agents[id] = agent;
      await saveAgents(storagePath, agents);
      
      // Emit notification if manager is available
      if (notificationManager) {
        await notificationManager.notifyAgentRegistered(id, agent.name, agent.description);
      }
      
      return { id };
    });
  };

  const unregisterAgent = async (id) => {
    validateAgentId(id);

    return withLock(async () => {
      const agents = await loadAgents(storagePath);
      
      if (!agents[id]) {
        return { success: false };
      }
      
      delete agents[id];
      await saveAgents(storagePath, agents);
      
      // Emit notification if manager is available
      if (notificationManager) {
        await notificationManager.notifyAgentUnregistered(id);
      }
      
      return { success: true };
    });
  };

  const discoverAgents = async () => {
    const agents = await loadAgents(storagePath);
    
    return Object.values(agents).map(({ id, name, description, status, lastActivityAt }) => ({
      id,
      name,
      description,
      status,
      lastActivityAt
    }));
  };

  const getAgent = async (id) => {
    const agents = await loadAgents(storagePath);
    return agents[id] || null;
  };

  const updateAgentStatus = async (id, status) => {
    validateAgentId(id);
    
    // Allow any string status up to 100 characters
    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      throw new Error('Status is required');
    }
    if (status.length > 100) {
      throw new Error('Status must be 100 characters or less');
    }

    return withLock(async () => {
      const agents = await loadAgents(storagePath);
      
      if (!agents[id]) {
        return { success: false, message: 'Agent not found' };
      }
      
      const previousStatus = agents[id].status;
      agents[id].status = status;
      agents[id].lastActivityAt = new Date().toISOString();
      
      await saveAgents(storagePath, agents);
      
      // Emit notification if status changed
      if (notificationManager && previousStatus !== status) {
        await notificationManager.notifyAgentStatusChange(id, status, {
          previousStatus,
          agentName: agents[id].name
        });
      }
      
      return { success: true, previousStatus, newStatus: status };
    });
  };

  const updateAgentActivity = async (id) => {
    validateAgentId(id);

    return withLock(async () => {
      const agents = await loadAgents(storagePath);
      
      if (!agents[id]) {
        return { success: false };
      }
      
      agents[id].lastActivityAt = new Date().toISOString();
      await saveAgents(storagePath, agents);
      
      return { success: true };
    });
  };

  const getAgentsByStatus = async (status) => {
    const agents = await loadAgents(storagePath);
    
    return Object.values(agents)
      .filter(agent => agent.status === status)
      .map(({ id, name, description, status, lastActivityAt }) => ({
        id,
        name,
        description,
        status,
        lastActivityAt
      }));
  };

  const getAllAgents = async () => {
    const agents = await loadAgents(storagePath);
    
    return Object.values(agents)
      .map(({ id, name, description, status, lastActivityAt }) => ({
        id,
        name,
        description,
        status,
        lastActivityAt
      }));
  };

  return {
    registerAgent,
    unregisterAgent,
    discoverAgents,
    getAgent,
    updateAgentStatus,
    updateAgentActivity,
    getAgentsByStatus,
    getAllAgents
  };
};