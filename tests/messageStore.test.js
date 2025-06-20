import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMessageStore } from '../src/lib/messageStore.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Message Store', () => {
  let store;
  const storageDir = '/tmp/mcp-agentic-test/test-messages';

  beforeEach(async () => {
    // Clean up any existing directory
    try {
      await fs.rm(storageDir, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    store = createMessageStore(storageDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(storageDir, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const result = await store.sendMessage('agent-1', 'agent-2', 'Hello from agent 1');
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
      expect(typeof result.messageId).toBe('string');
    });

    it('should store message as individual file', async () => {
      const { messageId } = await store.sendMessage('agent-1', 'agent-2', 'Test message');
      
      const messageFile = path.join(storageDir, `${messageId}.json`);
      const data = await fs.readFile(messageFile, 'utf-8');
      const message = JSON.parse(data);
      
      expect(message).toMatchObject({
        id: messageId,
        from: 'agent-1',
        to: 'agent-2',
        message: 'Test message',
        read: false
      });
      expect(message).toHaveProperty('timestamp');
    });

    it('should validate sender ID', async () => {
      await expect(store.sendMessage('', 'agent-2', 'Message')).rejects.toThrow('From agent ID is required');
      await expect(store.sendMessage(null, 'agent-2', 'Message')).rejects.toThrow('From agent ID is required');
    });

    it('should validate recipient ID', async () => {
      await expect(store.sendMessage('agent-1', '', 'Message')).rejects.toThrow('To agent ID is required');
      await expect(store.sendMessage('agent-1', null, 'Message')).rejects.toThrow('To agent ID is required');
    });

    it('should validate message content', async () => {
      await expect(store.sendMessage('agent-1', 'agent-2', '')).rejects.toThrow('Message content is required');
      await expect(store.sendMessage('agent-1', 'agent-2', null)).rejects.toThrow('Message content is required');
    });

    it('should handle concurrent message sends', async () => {
      const promises = [
        store.sendMessage('agent-1', 'agent-2', 'Message 1'),
        store.sendMessage('agent-2', 'agent-3', 'Message 2'),
        store.sendMessage('agent-3', 'agent-1', 'Message 3')
      ];
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Check all message files were created
      const files = await fs.readdir(storageDir);
      const messageFiles = files.filter(f => f.endsWith('.json'));
      expect(messageFiles).toHaveLength(3);
    });
  });

  describe('getMessagesForAgent', () => {
    it('should retrieve messages for specific agent', async () => {
      await store.sendMessage('agent-1', 'agent-2', 'Message 1');
      await store.sendMessage('agent-1', 'agent-2', 'Message 2');
      await store.sendMessage('agent-2', 'agent-3', 'Message 3');
      
      const messages = await store.getMessagesForAgent('agent-2');
      
      expect(messages).toHaveLength(2);
      expect(messages[0].to).toBe('agent-2');
      expect(messages[1].to).toBe('agent-2');
    });

    it('should retrieve only unread messages when specified', async () => {
      const { messageId } = await store.sendMessage('agent-1', 'agent-2', 'Message 1');
      await store.sendMessage('agent-1', 'agent-2', 'Message 2');
      
      // Mark first message as read
      await store.markMessageAsRead(messageId);
      
      const unreadMessages = await store.getMessagesForAgent('agent-2', { unreadOnly: true });
      expect(unreadMessages).toHaveLength(1);
    });

    it('should limit results when specified', async () => {
      for (let i = 0; i < 5; i++) {
        await store.sendMessage('agent-1', 'agent-2', `Message ${i}`);
      }
      
      const limitedMessages = await store.getMessagesForAgent('agent-2', { limit: 2 });
      expect(limitedMessages).toHaveLength(2);
    });

    it('should return empty array when no messages exist', async () => {
      const messages = await store.getMessagesForAgent('agent-1');
      expect(messages).toEqual([]);
    });

    it('should validate agent ID', async () => {
      await expect(store.getMessagesForAgent('')).rejects.toThrow('Agent agent ID is required');
      await expect(store.getMessagesForAgent(null)).rejects.toThrow('Agent agent ID is required');
    });

    it('should sort messages by timestamp (oldest first)', async () => {
      await store.sendMessage('agent-1', 'agent-2', 'First');
      await new Promise(resolve => setTimeout(resolve, 10));
      await store.sendMessage('agent-1', 'agent-2', 'Second');
      await new Promise(resolve => setTimeout(resolve, 10));
      await store.sendMessage('agent-1', 'agent-2', 'Third');
      
      const messages = await store.getMessagesForAgent('agent-2');
      expect(messages[0].message).toBe('First');
      expect(messages[1].message).toBe('Second');
      expect(messages[2].message).toBe('Third');
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read', async () => {
      const { messageId } = await store.sendMessage('agent-1', 'agent-2', 'Test message');
      
      const result = await store.markMessageAsRead(messageId);
      expect(result).toEqual({ success: true });
      
      const messageFile = path.join(storageDir, `${messageId}.json`);
      const data = await fs.readFile(messageFile, 'utf-8');
      const message = JSON.parse(data);
      expect(message.read).toBe(true);
    });

    it('should return false for non-existent message', async () => {
      const result = await store.markMessageAsRead('non-existent-id');
      expect(result).toEqual({ success: false });
    });

    it('should validate message ID', async () => {
      await expect(store.markMessageAsRead('')).rejects.toThrow('Message ID is required');
      await expect(store.markMessageAsRead(null)).rejects.toThrow('Message ID is required');
    });
  });

  describe('getAllMessages', () => {
    it('should retrieve all messages', async () => {
      await store.sendMessage('agent-1', 'agent-2', 'Message 1');
      await store.sendMessage('agent-2', 'agent-3', 'Message 2');
      await store.sendMessage('agent-3', 'agent-1', 'Message 3');
      
      const allMessages = await store.getAllMessages();
      
      expect(allMessages).toHaveLength(3);
      expect(allMessages.map(m => m.message)).toContain('Message 1');
      expect(allMessages.map(m => m.message)).toContain('Message 2');
      expect(allMessages.map(m => m.message)).toContain('Message 3');
    });

    it('should return empty array when no messages', async () => {
      const messages = await store.getAllMessages();
      expect(messages).toEqual([]);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const { messageId } = await store.sendMessage('agent-1', 'agent-2', 'Test message');
      
      const result = await store.deleteMessage(messageId);
      expect(result).toEqual({ success: true });
      
      const messages = await store.getAllMessages();
      expect(messages).toHaveLength(0);
    });

    it('should return false for non-existent message', async () => {
      const result = await store.deleteMessage('non-existent-id');
      expect(result).toEqual({ success: false });
    });

    it('should validate message ID', async () => {
      await expect(store.deleteMessage('')).rejects.toThrow('Message ID is required');
      await expect(store.deleteMessage(null)).rejects.toThrow('Message ID is required');
    });
  });

  describe('persistence', () => {
    it('should load existing messages on initialization', async () => {
      // Create a message with first store instance
      await store.sendMessage('agent-1', 'agent-2', 'Persistent message');
      
      // Create new store instance
      const newStore = createMessageStore(storageDir);
      const messages = await newStore.getAllMessages();
      
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Persistent message');
    });

    it('should handle corrupted message files gracefully', async () => {
      // Create a corrupted message file
      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(path.join(storageDir, 'msg-corrupted.json'), 'invalid json');
      
      // Also create a valid message
      await store.sendMessage('agent-1', 'agent-2', 'Valid message');
      
      // Should skip corrupted file and load valid ones
      const messages = await store.getAllMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Valid message');
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent operations without file locking', async () => {
      // Since each message is its own file, no locking is needed
      const operations = [];
      
      // Send messages concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(store.sendMessage(`agent-${i % 3}`, `agent-${(i + 1) % 3}`, `Message ${i}`));
      }
      
      const results = await Promise.all(operations);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify all messages exist
      const messages = await store.getAllMessages();
      expect(messages).toHaveLength(10);
    });
  });
});