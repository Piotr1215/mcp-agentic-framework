import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { 
  registerAgent, 
  unregisterAgent, 
  discoverAgents,
  toggleWrites,
  __resetForTesting 
} from '../src/tools.js';

const XDG_STATE_HOME = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
const LOCK_FILE = path.join(XDG_STATE_HOME, 'mcp-agentic-framework', 'write-lock.json');

describe('Write Lock System', () => {
  let minimiId;
  let fatOwlId;
  let regularAgentId;

  beforeEach(async () => {
    await __resetForTesting();
    
    // Clean up lock file
    try {
      await fs.unlink(LOCK_FILE);
    } catch (e) {
      // File might not exist
    }
  });

  afterEach(async () => {
    // Clean up agents
    if (minimiId) await unregisterAgent(minimiId);
    if (fatOwlId) await unregisterAgent(fatOwlId);
    if (regularAgentId) await unregisterAgent(regularAgentId);
    
    // Clean up lock file
    try {
      await fs.unlink(LOCK_FILE);
    } catch (e) {
      // File might not exist
    }
  });

  describe('Minimi presence lock', () => {
    it('should activate lock when minimi registers', async () => {
      const result = await registerAgent('minimi', 'The enforcer of code quality');
      minimiId = result.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Check lock file exists and is locked
      const lockState = JSON.parse(await fs.readFile(LOCK_FILE, 'utf-8'));
      expect(lockState.locked).toBe(true);
      expect(lockState.lockedBy).toBe('minimi-presence');
    });

    it('should deactivate lock when minimi unregisters', async () => {
      // Register minimi
      const result = await registerAgent('minimi', 'The enforcer');
      minimiId = result.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Verify lock is active
      let lockState = JSON.parse(await fs.readFile(LOCK_FILE, 'utf-8'));
      expect(lockState.locked).toBe(true);
      
      // Unregister minimi
      await unregisterAgent(minimiId);
      minimiId = null;
      
      // Verify lock is deactivated
      lockState = JSON.parse(await fs.readFile(LOCK_FILE, 'utf-8'));
      expect(lockState.locked).toBe(false);
    });

    it('should keep lock active if multiple minimis exist', async () => {
      // Register first minimi
      const result1 = await registerAgent('minimi', 'The first enforcer');
      const minimiId1 = result1.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Register second minimi (edge case)
      const result2 = await registerAgent('minimi', 'The second enforcer');
      const minimiId2 = result2.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Unregister first minimi
      await unregisterAgent(minimiId1);
      
      // Lock should still be active
      const lockState = JSON.parse(await fs.readFile(LOCK_FILE, 'utf-8'));
      expect(lockState.locked).toBe(true);
      
      // Clean up
      await unregisterAgent(minimiId2);
    });
  });

  describe('toggleWrites method', () => {
    it('should only allow minimi to toggle writes', async () => {
      // Register regular agent
      const result = await registerAgent('regular-agent', 'A regular agent');
      regularAgentId = result.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Try to toggle writes as regular agent
      await expect(toggleWrites(regularAgentId, false))
        .rejects
        .toThrow('Only minimi can toggle write access');
    });

    it('should allow minimi to toggle writes', async () => {
      // Register minimi
      const result = await registerAgent('minimi', 'The enforcer');
      minimiId = result.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Toggle writes off
      const toggleResult = await toggleWrites(minimiId, false, 'Testing toggle');
      
      // Check the structure of the response
      expect(toggleResult).toBeDefined();
      expect(toggleResult.content).toBeDefined();
      expect(toggleResult.content[0]).toBeDefined();
      
      // The response contains the broadcast message in the text
      expect(toggleResult.content[0].text).toContain('The write state is hereby blocked');
      
      const lockState = JSON.parse(await fs.readFile(LOCK_FILE, 'utf-8'));
      expect(lockState.locked).toBe(true);
      expect(lockState.lockedBy).toBe('minimi-toggle');
      expect(lockState.reason).toBe('Testing toggle');
    });

    it('should broadcast lock state changes', async () => {
      // Register minimi
      const result = await registerAgent('minimi', 'The enforcer');
      minimiId = result.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Toggle writes
      const toggleResult = await toggleWrites(minimiId, false);
      
      // Verify broadcast message
      expect(toggleResult.content[0].text).toContain('The write state is hereby blocked');
    });
  });

  describe('Integration with other agents', () => {
    it('should not affect other agent operations', async () => {
      // Register agents
      const result1 = await registerAgent('fat-owl', 'Knowledge custodian');
      fatOwlId = result1.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      const result2 = await registerAgent('regular-agent', 'Regular worker');
      regularAgentId = result2.content[0].text.match(/ID: (agent-\d+-\w+)/)[1];
      
      // Agents should exist
      const agents = await discoverAgents();
      expect(agents.content[0].text).toContain('fat-owl');
      expect(agents.content[0].text).toContain('regular-agent');
    });
  });
});