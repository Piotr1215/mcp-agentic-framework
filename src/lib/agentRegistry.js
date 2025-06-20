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

const createAgent = (id, name, description) => ({
  id,
  name,
  description,
  registeredAt: new Date().toISOString()
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
export const createAgentRegistry = (storagePath) => {
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
      
      return { success: true };
    });
  };

  const discoverAgents = async () => {
    const agents = await loadAgents(storagePath);
    
    return Object.values(agents).map(({ id, name, description }) => ({
      id,
      name,
      description
    }));
  };

  const getAgent = async (id) => {
    const agents = await loadAgents(storagePath);
    return agents[id] || null;
  };

  return {
    registerAgent,
    unregisterAgent,
    discoverAgents,
    getAgent
  };
};