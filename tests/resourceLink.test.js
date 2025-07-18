import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAgent, discoverAgents, checkForMessages, sendBroadcast, resetInstances, unregisterAgent } from '../src/tools.js';
import { getResourceContent, getResourcesWithLinks } from '../src/resourceDefinitions.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Resource Link Tool Results', () => {
  beforeEach(async () => {
    // Clean up storage before each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    // Reset singleton instances
    await resetInstances();
  });

  afterEach(async () => {
    // Clean up storage after each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  describe('Tool results with resource_link', () => {
    it('should return resource_link when discovering agents with detailed profiles', async () => {
      // Register test agents
      await registerAgent('code-reviewer', 'Reviews code for quality');
      await registerAgent('test-runner', 'Runs automated tests');

      const result = await discoverAgents();
      
      // Should return both inline data and resource links
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent.agents).toBeDefined();
      expect(result.structuredContent.agents).toHaveLength(2);
      
      // Should include resource_link for detailed profiles
      expect(result._meta?.resource_links).toBeDefined();
      expect(result._meta.resource_links).toHaveLength(2);
      
      const firstLink = result._meta.resource_links[0];
      expect(firstLink).toMatchObject({
        uri: expect.stringContaining('agent://'),
        title: expect.stringContaining('Profile'),
        description: expect.stringContaining('profile')
      });
    });

    it('should return resource_link for message history', async () => {
      // Register test agents and send messages
      const agent1 = await registerAgent('agent-1', 'First agent');
      const agent2 = await registerAgent('agent-2', 'Second agent');
      
      const agent1Id = agent1.structuredContent?.id;
      const agent2Id = agent2.structuredContent?.id;
      
      // Import sendMessage function
      const { sendMessage } = await import('../src/tools.js');
      
      // Send test messages
      await sendMessage(agent2Id, agent1Id, 'Can you review this code?');
      await sendMessage(agent1Id, agent2Id, 'Sure, I\'ll take a look');
      
      // Wait a bit to ensure messages are saved
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await checkForMessages(agent2Id);
      
      // Should return messages with resource_link to conversation
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent?.messages).toBeDefined();
      expect(result._meta?.resource_links).toBeDefined();
      expect(result._meta.resource_links).toContainEqual({
        uri: expect.stringMatching(/conversation:\/\//),
        title: 'Conversation History',
        description: 'Full conversation thread between agents'
      });
    });

    it('should support resource_link in broadcast results', async () => {
      // Register test agents
      await registerAgent('worker-1', 'Worker agent 1');
      await registerAgent('worker-2', 'Worker agent 2');
      const orchestrator = await registerAgent('orchestrator', 'Orchestrator agent');
      const orchestratorId = orchestrator.structuredContent?.id;

      const result = await sendBroadcast(
        orchestratorId,
        'Important broadcast message',
        'high'
      );
      
      // Should succeed without workflow resource links
      expect(result.structuredContent?.success).toBe(true);
      // Resource links should either be undefined or empty for broadcasts without workflows
      if (result._meta?.resource_links) {
        expect(result._meta.resource_links).toHaveLength(0);
      }
    });
  });

  describe('Resource content retrieval', () => {
    it('should retrieve guide resources', async () => {
      const guideUri = 'guide://how-to-communicate';
      
      const content = await getResourceContent(guideUri);
      
      expect(content.uri).toBe(guideUri);
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toContain('AGENT COMMUNICATION GUIDE');
    });

    // Workflow resource links have been replaced with hooks
    // This test is no longer applicable
    it('should not retrieve workflow template resources (workflows removed)', async () => {
      // Workflows are now handled by hooks, not resource links
      // Register a test agent first
      const testResult = await registerAgent('workflow-test-agent', 'Test agent for workflow check');
      const testAgentId = testResult.structuredContent.id;
      
      try {
        // This test verifies that workflow resources are no longer part of the system
        const result = await getResourceContent(`agent://${testAgentId}/profile`);
        expect(result).toBeDefined();
        
        // Workflow resources no longer exist in the system
        await expect(getResourceContent('workflow://code-review')).rejects.toThrow();
      } finally {
        // Cleanup
        await unregisterAgent(testAgentId);
      }
    });

    it('should handle resource not found errors', async () => {
      const invalidUri = 'invalid://resource';
      
      await expect(getResourceContent(invalidUri)).rejects.toThrow('Resource not found');
    });
  });
});