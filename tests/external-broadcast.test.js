import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/http-server-direct.js';
import { registerAgent, unregisterAgent } from '../src/tools.js';

describe('External Broadcast API', () => {
  let server;
  let testAgentId;
  const API_KEY = process.env.MCP_EXTERNAL_API_KEY || 'test-key-123';

  beforeEach(async () => {
    // Start server on random port (0 = let OS choose)
    server = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => {
        resolve(srv);
      });
    });
    
    // Register a test agent to receive broadcasts
    const result = await registerAgent('test-agent', 'Test agent for broadcast tests');
    testAgentId = result.structuredContent.id;
  });

  afterEach(async () => {
    // Cleanup
    if (testAgentId) {
      await unregisterAgent(testAgentId);
    }
    server.close();
  });

  describe('POST /external/broadcast', () => {
    it('should successfully send a broadcast with valid API key', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'test-system',
          message: 'Test broadcast message',
          priority: 'normal'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.recipientCount).toBeGreaterThanOrEqual(1);
      expect(response.body.result.priority).toBe('normal');
      expect(response.body.result.message).toContain('test-system');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', 'wrong-key')
        .send({
          from: 'test-system',
          message: 'Test message'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should reject requests without API key', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .send({
          from: 'test-system',
          message: 'Test message'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject requests missing required fields', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'test-system'
          // missing message
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should use default priority when not specified', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'test-system',
          message: 'Test message without priority'
        });

      expect(response.status).toBe(200);
      expect(response.body.result.priority).toBe('normal');
    });

    it('should handle different priority levels', async () => {
      const priorities = ['low', 'normal', 'high'];
      
      for (const priority of priorities) {
        const response = await request(server)
          .post('/external/broadcast')
          .set('X-API-Key', API_KEY)
          .send({
            from: 'priority-test',
            message: `Test with ${priority} priority`,
            priority
          });

        expect(response.status).toBe(200);
        expect(response.body.result.priority).toBe(priority);
      }
    });

    it('should not create agents for external broadcasts', async () => {
      // Get initial agent count
      const initialAgents = await request(server)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'discover-agents',
            arguments: {}
          },
          id: 1
        });
      
      const initialCount = initialAgents.body.result.structuredContent.agents.length;

      // Send external broadcast
      await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'external-test-system',
          message: 'Test message'
        });

      // Check agent count hasn't increased
      const finalAgents = await request(server)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'discover-agents',
            arguments: {}
          },
          id: 2
        });

      const finalCount = finalAgents.body.result.structuredContent.agents.length;
      expect(finalCount).toBe(initialCount);
    });

    it('should deliver broadcasts to all active agents', async () => {
      // This test verifies that external broadcasts are delivered
      // The new implementation doesn't require the sender to be an agent
      
      // Send broadcast
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'multi-recipient-test',
          message: 'Message for multiple agents'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.recipientCount).toBeGreaterThanOrEqual(1);
      
      // The actual message delivery is verified by checking that no errors occurred
      // In the real system, messages are delivered via the file-based message store
    });

    it('should handle empty agent list gracefully', async () => {
      // Unregister all agents
      await unregisterAgent(testAgentId);
      testAgentId = null;

      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'no-recipients-test',
          message: 'Message with no recipients'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.recipientCount).toBe(0);
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = 'Test with "quotes", \nnewlines, and emoji! 🎉';
      
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .send({
          from: 'special-chars-test',
          message: specialMessage
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // The external broadcast endpoint handles special characters properly
      // by using proper JSON encoding in the shell script and server
    });

    it('should support CORS headers', async () => {
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .set('Origin', 'http://example.com')
        .send({
          from: 'cors-test',
          message: 'CORS test message'
        });

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Integration with shell script', () => {
    it('should accept broadcasts from __mcp_broadcast.sh format', async () => {
      // Simulate what the shell script sends
      const response = await request(server)
        .post('/external/broadcast')
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
        .send({
          from: 'external-broadcast',
          message: 'Piped message from shell script',
          priority: 'normal'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});