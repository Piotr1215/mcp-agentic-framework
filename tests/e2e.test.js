import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAgent, unregisterAgent, discoverAgents, sendMessage, checkForMessages, resetInstances } from '../src/tools.js';
import * as fs from 'fs/promises';

// Helper to add small delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('End-to-End Multi-Agent Communication', () => {
  beforeEach(async () => {
    // Clean up storage
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    // Reset singleton instances
    await resetInstances();
  });

  afterEach(async () => {
    // Clean up storage
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  it('should simulate a complete multi-agent communication workflow', async () => {
    // Step 1: Register three agents
    const developer = await registerAgent(
      'DeveloperAgent',
      'Responsible for writing code and implementing features'
    );
    
    const tester = await registerAgent(
      'TesterAgent',
      'Responsible for testing code and finding bugs'
    );
    
    const architect = await registerAgent(
      'ArchitectAgent',
      'Responsible for system design and architecture decisions'
    );

    expect(developer.structuredContent.id).toBeDefined();
    expect(tester.structuredContent.id).toBeDefined();
    expect(architect.structuredContent.id).toBeDefined();

    // Step 2: Verify all agents are registered
    const agents = await discoverAgents();
    expect(agents.structuredContent.agents).toHaveLength(3);
    
    // Verify the agents we registered are in the list
    const agentIds = agents.structuredContent.agents.map(a => a.id);
    expect(agentIds).toContain(developer.structuredContent.id);
    expect(agentIds).toContain(tester.structuredContent.id);
    expect(agentIds).toContain(architect.structuredContent.id);

    // Step 3: Architect sends task to Developer
    await sendMessage(
      developer.structuredContent.id,
      architect.structuredContent.id,
      'Please implement the user authentication module using JWT tokens'
    );

    // Step 4: Developer checks messages
    let devMessages = await checkForMessages(developer.structuredContent.id);
    
    expect(devMessages.structuredContent.messages).toHaveLength(1);
    expect(devMessages.structuredContent.messages[0].message).toContain('authentication module');

    // Step 5: Developer sends update to Architect and request to Tester
    await sendMessage(
      architect.structuredContent.id,
      developer.structuredContent.id,
      'Authentication module implemented. Ready for review.'
    );

    await sendMessage(
      tester.structuredContent.id,
      developer.structuredContent.id,
      'Please test the authentication module at /api/auth'
    );

    // Step 6: Tester checks messages
    const testerMessages = await checkForMessages(tester.structuredContent.id);
    
    expect(testerMessages.structuredContent.messages).toHaveLength(1);
    expect(testerMessages.structuredContent.messages[0].from).toBe(developer.structuredContent.id);

    // Step 7: Tester sends bug report
    await sendMessage(
      developer.structuredContent.id,
      tester.structuredContent.id,
      'Found issue: JWT token expiry not handled correctly'
    );

    // Step 8: Developer checks for new messages
    devMessages = await checkForMessages(developer.structuredContent.id);
    
    expect(devMessages.structuredContent.messages).toHaveLength(1);
    expect(devMessages.structuredContent.messages[0].message).toContain('JWT token expiry');

    // Step 9: Verify messages are deleted after retrieval
    const noNewMessages = await checkForMessages(developer.structuredContent.id);
    
    expect(noNewMessages.structuredContent.messages).toHaveLength(0);

    // Step 10: Unregister an agent
    const unregResult = await unregisterAgent(tester.structuredContent.id);
    
    expect(unregResult.structuredContent.success).toBe(true);

    // Verify agent is removed
    const remainingAgents = await discoverAgents();
    expect(remainingAgents.structuredContent.agents).toHaveLength(2);
  });

  it('should handle error cases properly', async () => {
    // Try to send message with non-existent agents
    await expect(sendMessage(
      'non-existent-2',
      'non-existent-1',
      'This should fail'
    )).rejects.toThrow('Sender agent not found');

    // Try to check messages for non-existent agent
    await expect(
      checkForMessages('non-existent')
    ).rejects.toThrow('Agent not found');
  });
});