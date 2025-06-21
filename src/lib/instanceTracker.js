import * as fs from 'fs/promises';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default mapping file location
const DEFAULT_MAPPING_FILE = '/tmp/mcp-claude-agent-mapping.json';

// Pure functions for instance tracking
const createMapping = (instanceId, agentId, agentName) => ({
  agentId,
  agentName,
  instanceId,
  registeredAt: new Date().toISOString()
});

// Storage operations
const ensureStorageDirectory = async (storagePath) => {
  const dir = path.dirname(storagePath);
  await fs.mkdir(dir, { recursive: true });
};

const loadMappings = async (storagePath) => {
  try {
    const data = await fs.readFile(storagePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

const saveMappings = async (storagePath, mappings) => {
  await ensureStorageDirectory(storagePath);
  await fs.writeFile(storagePath, JSON.stringify(mappings, null, 2));
};

// Lock mechanism for concurrent access
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
export const createInstanceTracker = (storagePath = DEFAULT_MAPPING_FILE) => {
  const lock = createLock();

  const withLock = async (operation) => {
    await lock.acquire();
    try {
      return await operation();
    } finally {
      lock.release();
    }
  };

  const trackInstance = async (instanceId, agentId, agentName) => {
    if (!instanceId || !agentId) {
      throw new Error('Both instanceId and agentId are required');
    }

    return withLock(async () => {
      const mappings = await loadMappings(storagePath);
      mappings[instanceId] = createMapping(instanceId, agentId, agentName);
      await saveMappings(storagePath, mappings);
      
      return { success: true, instanceId, agentId };
    });
  };

  const untrackInstance = async (instanceId) => {
    if (!instanceId) {
      throw new Error('instanceId is required');
    }

    return withLock(async () => {
      const mappings = await loadMappings(storagePath);
      const mapping = mappings[instanceId];
      
      if (!mapping) {
        return { success: false, message: 'Instance not found' };
      }
      
      delete mappings[instanceId];
      await saveMappings(storagePath, mappings);
      
      return { 
        success: true, 
        agentId: mapping.agentId,
        agentName: mapping.agentName 
      };
    });
  };

  const getAgentByInstance = async (instanceId) => {
    if (!instanceId) {
      return null;
    }

    const mappings = await loadMappings(storagePath);
    return mappings[instanceId] || null;
  };

  const getAllMappings = async () => {
    return await loadMappings(storagePath);
  };

  const clearStaleInstances = async (maxAgeHours = 24) => {
    return withLock(async () => {
      const mappings = await loadMappings(storagePath);
      const now = new Date();
      const staleInstances = [];

      for (const [instanceId, mapping] of Object.entries(mappings)) {
        const registeredAt = new Date(mapping.registeredAt);
        const ageHours = (now - registeredAt) / (1000 * 60 * 60);
        
        if (ageHours > maxAgeHours) {
          staleInstances.push({ instanceId, ...mapping });
          delete mappings[instanceId];
        }
      }

      if (staleInstances.length > 0) {
        await saveMappings(storagePath, mappings);
      }

      return { cleared: staleInstances.length, instances: staleInstances };
    });
  };

  return {
    trackInstance,
    untrackInstance,
    getAgentByInstance,
    getAllMappings,
    clearStaleInstances
  };
};

// Export default instance
export default createInstanceTracker();