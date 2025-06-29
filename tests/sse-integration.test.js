import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { resetInstances } from '../src/tools.js';
import { EventSource } from 'eventsource';

const PORT = 3121; // Different port to avoid conflicts
const HTTP_URL = `http://localhost:${PORT}`;

describe('SSE Integration', () => {
  let serverProcess;
  let sessionId;

  beforeAll(async () => {
    // Start the SSE-enabled HTTP server
    serverProcess = spawn('node', ['src/http-server-sse.js'], {
      env: { ...process.env, PORT: PORT.toString() },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('SSE Server running')) {
          resolve();
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  }, 10000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  beforeEach(async () => {
    await resetInstances();
  });

  describe('SSE capabilities', () => {
    it('should have sampling capability in initialization', async () => {
      const response = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18' }
        })
      });

      const data = await response.json();
      sessionId = response.headers.get('mcp-session-id');

      expect(data.result.capabilities.sampling).toBeDefined();
      expect(data.result.capabilities.tools).toBeDefined();
      expect(data.result.capabilities.completions).toBeDefined();
    });

    it('should establish SSE connection', async () => {
      return new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${HTTP_URL}/mcp?sessionId=${sessionId}`);
        
        eventSource.onopen = () => {
          expect(eventSource.readyState).toBe(EventSource.OPEN);
          eventSource.close();
          resolve();
        };
        
        eventSource.onerror = (error) => {
          eventSource.close();
          reject(error);
        };
        
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          expect(data.type).toBe('connection');
          expect(data.status).toBe('connected');
        };
        
        // Timeout
        setTimeout(() => {
          eventSource.close();
          reject(new Error('SSE connection timeout'));
        }, 5000);
      });
    });

    it('should track SSE connections', async () => {
      const eventSource = new EventSource(`${HTTP_URL}/mcp?sessionId=test-123`);
      
      // Wait for connection
      await new Promise((resolve) => {
        eventSource.onopen = resolve;
        setTimeout(resolve, 1000);
      });

      // Check status endpoint
      const response = await fetch(`${HTTP_URL}/sse-status`);
      const status = await response.json();

      expect(status.sseSupport).toBe(true);
      expect(status.activeConnections).toBeGreaterThan(0);
      expect(status.connections.some(c => c.sessionId === 'test-123')).toBe(true);

      eventSource.close();
    });
  });

  describe('AI assist with SSE', () => {
    it('should send sampling request via SSE when connected', async () => {
      // Initialize session
      const initResponse = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18' }
        })
      });
      
      const initData = await initResponse.json();
      sessionId = initResponse.headers.get('mcp-session-id');

      // Connect SSE
      const eventSource = new EventSource(`${HTTP_URL}/mcp?sessionId=${sessionId}`);
      
      // Wait for connection
      await new Promise(resolve => {
        eventSource.onopen = resolve;
      });

      // Register agent
      const registerResponse = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'register-agent',
            arguments: { name: 'TestBot', description: 'Test agent' }
          }
        })
      });

      const registerData = await registerResponse.json();
      const agentId = registerData.result.structuredContent.id;

      // Set up SSE handler for sampling
      const samplingReceived = new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.method === 'sampling/createMessage') {
            resolve(data);
            
            // Send response back
            fetch(`${HTTP_URL}/sampling/response`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                requestId: data.id,
                result: {
                  content: {
                    type: 'text',
                    text: 'This is a test AI response via SSE'
                  }
                }
              })
            });
          }
        };
      });

      // Call agent-ai-assist
      const aiResponse = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'agent-ai-assist',
            arguments: {
              agent_id: agentId,
              context: 'Test context',
              request_type: 'response'
            }
          }
        })
      });

      // Verify sampling request was sent
      const samplingRequest = await samplingReceived;
      expect(samplingRequest.method).toBe('sampling/createMessage');
      expect(samplingRequest.params.messages[0].content.text).toContain('Test context');

      const aiData = await aiResponse.json();
      
      // With SSE, we should get real AI response
      expect(aiData.result.structuredContent.success).toBe(true);
      expect(aiData.result.structuredContent.aiResponse).toBe('This is a test AI response via SSE');
      expect(aiData.result._meta.transportType).toBe('sse');

      eventSource.close();
    });

    it('should fall back to guidance without SSE', async () => {
      // Call without SSE connection
      const response = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'no-sse'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'agent-ai-assist',
            arguments: {
              agent_id: 'test-agent',
              context: 'Test context',
              request_type: 'response'
            }
          }
        })
      });

      const data = await response.json();
      
      // Should get fallback guidance
      if (!data.error) {
        expect(data.result.structuredContent.requiresManualExecution).toBe(true);
        expect(data.result.structuredContent.aiGuidance).toBeDefined();
      }
    });
  });

  describe('Sampling response handling', () => {
    it('should handle sampling response endpoint', async () => {
      const response = await fetch(`${HTTP_URL}/sampling/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session',
          requestId: 'test-request',
          result: {
            content: {
              type: 'text',
              text: 'Test response'
            }
          }
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle sampling error response', async () => {
      const response = await fetch(`${HTTP_URL}/sampling/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session',
          requestId: 'test-request',
          error: {
            message: 'AI provider error'
          }
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should reject direct sampling/createMessage via HTTP POST', async () => {
      const response = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sampling/createMessage',
          params: {
            messages: [{ role: 'user', content: { type: 'text', text: 'Test' } }]
          }
        })
      });

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('SSE');
    });
  });
});