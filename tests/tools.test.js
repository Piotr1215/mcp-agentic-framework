import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAgent, unregisterAgent, discoverAgents, sendMessage, checkForMessages, resetInstances } from '../src/tools.js';
import * as fs from 'fs/promises';

describe('Tool Handlers', () => {
  beforeEach(async () => {
    // Clean up storage before each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    // Reset singleton instances
    resetInstances();
  });

  afterEach(async () => {
    // Clean up storage after each test
    try {
      await fs.rm('/tmp/mcp-agentic-framework', { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  describe('registerAgent', () => {
    it('should register agent and return structured response', async () => {
      const result = await registerAgent('TestAgent', 'A test agent for testing');
      
      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('registered successfully');
      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toHaveProperty('id');
      expect(result).toHaveProperty('_meta');
      expect(result._meta).toHaveProperty('executionTime');
      expect(result._meta).toHaveProperty('timestamp');
    });

    it('should throw error for invalid inputs', async () => {
      await expect(registerAgent('', 'Description')).rejects.toThrow('Agent name is required');
      await expect(registerAgent('Agent', '')).rejects.toThrow('Agent description is required');
    });
  });

  describe('discoverAgents', () => {
    it('should return empty array when no agents registered', async () => {
      const result = await discoverAgents();
      
      expect(result.structuredContent).toEqual({ agents: [] });
      expect(result.content[0].text).toContain('No agents currently registered');
    });

    it('should return registered agents with details', async () => {
      const agent1 = await registerAgent('Agent1', 'First agent');
      const agent2 = await registerAgent('Agent2', 'Second agent');
      
      const result = await discoverAgents();
      
      expect(result.structuredContent.agents).toHaveLength(2);
      expect(result.content[0].text).toContain('Found 2 registered agents');
      expect(result.content[0].text).toContain('Agent1');
      expect(result.content[0].text).toContain('Agent2');
      expect(result.content[0].text).toContain(agent1.structuredContent.id);
      expect(result.content[0].text).toContain(agent2.structuredContent.id);
      expect(result.content[0].text).toContain('First agent');
      expect(result.content[0].text).toContain('Second agent');
      expect(result._meta.agentCount).toBe(2);
    });
  });

  describe('sendMessage', () => {
    it('should send message between registered agents', async () => {
      const agent1 = await registerAgent('Agent1', 'First agent');
      const agent2 = await registerAgent('Agent2', 'Second agent');
      
      const result = await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'Hello from Agent1'
      );
      
      expect(result.structuredContent.success).toBe(true);
      expect(result.content[0].text).toContain('Message sent successfully');
    });

    it('should throw error if sender agent not found', async () => {
      const agent = await registerAgent('Agent1', 'First agent');
      
      await expect(
        sendMessage(agent.structuredContent.id, 'non-existent', 'Hello')
      ).rejects.toThrow('Sender agent not found');
    });

    it('should throw error if recipient agent not found', async () => {
      const agent = await registerAgent('Agent1', 'First agent');
      
      await expect(
        sendMessage('non-existent', agent.structuredContent.id, 'Hello')
      ).rejects.toThrow('Recipient agent not found');
    });
  });

  describe('checkForMessages', () => {
    it('should return empty array when no messages', async () => {
      const agent = await registerAgent('Agent1', 'First agent');
      
      const result = await checkForMessages(agent.structuredContent.id);
      
      expect(result.structuredContent).toEqual({ messages: [] });
      expect(result.content[0].text).toContain('No new messages');
    });

    it('should return unread messages and mark them as read', async () => {
      const agent1 = await registerAgent('Agent1', 'First agent');
      const agent2 = await registerAgent('Agent2', 'Second agent');
      
      // Send messages
      await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'Message 1'
      );
      await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'Message 2'
      );
      
      // Check messages
      const result = await checkForMessages(agent2.structuredContent.id);
      
      expect(result.structuredContent.messages).toHaveLength(2);
      expect(result.content[0].text).toContain('Retrieved 2 new messages');
      expect(result.content[0].text).toContain('Message 1');
      expect(result.content[0].text).toContain('Message 2');
      expect(result.content[0].text).toContain(agent1.structuredContent.id);
      expect(result.structuredContent.messages[0]).toMatchObject({
        from: agent1.structuredContent.id,
        fromName: 'Agent1',
        message: 'Message 1',
        timestamp: expect.any(String)
      });
      expect(result.content[0].text).toContain('Retrieved 2 new messages');
      
      // Check again - should be empty (messages deleted after retrieval)
      const secondCheck = await checkForMessages(agent2.structuredContent.id);
      expect(secondCheck.structuredContent.messages).toHaveLength(0);
    });

    it('should throw error if agent not found', async () => {
      await expect(
        checkForMessages('non-existent-agent')
      ).rejects.toThrow('Agent not found');
    });

    it('should delete messages from storage after retrieval', async () => {
      const agent1 = await registerAgent('Agent1', 'First agent');
      const agent2 = await registerAgent('Agent2', 'Second agent');
      
      // Send multiple messages
      await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'Test message 1'
      );
      await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'Test message 2'
      );
      
      // Check messages (which should delete them)
      const messages = await checkForMessages(agent2.structuredContent.id);
      expect(messages.structuredContent.messages).toHaveLength(2);
      
      // Verify messages are deleted by trying to retrieve them again
      const secondCheck = await checkForMessages(agent2.structuredContent.id);
      expect(secondCheck.structuredContent.messages).toHaveLength(0);
      
      // Send another message to verify the system still works
      await sendMessage(
        agent2.structuredContent.id,
        agent1.structuredContent.id,
        'New message after deletion'
      );
      
      const thirdCheck = await checkForMessages(agent2.structuredContent.id);
      expect(thirdCheck.structuredContent.messages).toHaveLength(1);
      expect(thirdCheck.structuredContent.messages[0].message).toBe('New message after deletion');
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister existing agent', async () => {
      const agent = await registerAgent('TestAgent', 'Test agent');
      
      const result = await unregisterAgent(agent.structuredContent.id);
      
      expect(result.structuredContent.success).toBe(true);
      expect(result.content[0].text).toContain('unregistered successfully');
      
      // Verify agent is gone
      const agents = await discoverAgents();
      expect(agents.structuredContent.agents).toHaveLength(0);
    });

    it('should return false for non-existent agent', async () => {
      const result = await unregisterAgent('non-existent-id');
      
      expect(result.structuredContent.success).toBe(false);
      expect(result.content[0].text).toContain('not found');
    });
  });
});