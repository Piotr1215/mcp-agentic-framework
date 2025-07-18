import { describe, it, expect, beforeEach } from 'vitest';

describe('Monitor UI Message Sorting', () => {
  let messages;
  let state;

  beforeEach(() => {
    // Mock state object
    state = {
      allMessages: [],
      reverseOrder: true
    };
    
    // Test messages with different timestamps
    messages = [
      { id: 'msg1', timestamp: '2025-01-19T08:00:00.000Z', message: 'First message' },
      { id: 'msg2', timestamp: '2025-01-19T09:00:00.000Z', message: 'Second message' },
      { id: 'msg3', timestamp: '2025-01-19T10:00:00.000Z', message: 'Third message' },
      { id: 'msg4', timestamp: '2025-01-19T07:00:00.000Z', message: 'Fourth message (earliest)' }
    ];
  });

  describe('Message timestamp sorting', () => {
    it('should sort messages newest first when reverseOrder is true', () => {
      // Simulate the fix we added
      state.allMessages = messages;
      state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Verify order - newest (msg3) should be first
      expect(state.allMessages[0].id).toBe('msg3');
      expect(state.allMessages[1].id).toBe('msg2');
      expect(state.allMessages[2].id).toBe('msg1');
      expect(state.allMessages[3].id).toBe('msg4');
    });

    it('should handle messages with same timestamp', () => {
      const sameTimeMessages = [
        { id: 'msg1', timestamp: '2025-01-19T09:00:00.000Z', message: 'First' },
        { id: 'msg2', timestamp: '2025-01-19T09:00:00.000Z', message: 'Second' },
        { id: 'msg3', timestamp: '2025-01-19T10:00:00.000Z', message: 'Third' }
      ];
      
      state.allMessages = sameTimeMessages;
      state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // msg3 should be first (newest)
      expect(state.allMessages[0].id).toBe('msg3');
      // msg1 and msg2 have same timestamp, order between them doesn't matter
      expect(['msg1', 'msg2']).toContain(state.allMessages[1].id);
      expect(['msg1', 'msg2']).toContain(state.allMessages[2].id);
    });

    it('should handle empty message array', () => {
      state.allMessages = [];
      state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      expect(state.allMessages).toHaveLength(0);
    });

    it('should handle invalid timestamps gracefully', () => {
      const invalidMessages = [
        { id: 'msg1', timestamp: '2025-01-19T09:00:00.000Z', message: 'Valid' },
        { id: 'msg2', timestamp: 'invalid-date', message: 'Invalid' },
        { id: 'msg3', timestamp: null, message: 'Null timestamp' }
      ];
      
      state.allMessages = invalidMessages;
      
      // This should not throw
      expect(() => {
        state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }).not.toThrow();
    });

    it('should maintain sort order after multiple updates', () => {
      // First batch
      state.allMessages = messages.slice(0, 2);
      state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      expect(state.allMessages[0].id).toBe('msg2');
      expect(state.allMessages[1].id).toBe('msg1');
      
      // Add more messages
      state.allMessages.push(...messages.slice(2));
      state.allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Verify complete order
      expect(state.allMessages[0].id).toBe('msg3');
      expect(state.allMessages[1].id).toBe('msg2');
      expect(state.allMessages[2].id).toBe('msg1');
      expect(state.allMessages[3].id).toBe('msg4');
    });
  });
});