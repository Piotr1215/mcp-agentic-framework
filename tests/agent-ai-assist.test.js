import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  agentAiAssist,
  registerAgent,
  resetInstances,
  setMcpServer
} from '../src/tools.js';

describe('Agent AI Assist', () => {
  let mockServer;
  let testAgentId;

  beforeEach(async () => {
    await resetInstances();
    
    // Create a mock MCP server
    mockServer = {
      request: vi.fn()
    };
    
    // Register a test agent
    const result = await registerAgent('TestAgent', 'A test agent for AI assistance');
    testAgentId = result.structuredContent.id;
  });

  describe('with MCP sampling support', () => {
    beforeEach(() => {
      setMcpServer(mockServer);
    });

    it('should generate response for message context', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'I can help you with that analysis. Let me examine the data patterns.'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Can you analyze this data pattern?',
        'response'
      );
      
      expect(result.content[0].text).toContain('AI assistance provided for response request');
      expect(result.structuredContent).toEqual({
        success: true,
        aiResponse: 'I can help you with that analysis. Let me examine the data patterns.',
        requestType: 'response'
      });
      
      expect(mockServer.request).toHaveBeenCalledWith({
        method: 'sampling/createMessage',
        params: expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('TestAgent')
              })
            })
          ])
        })
      });
    });

    it('should generate creative status message', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: '🔍 Analyzing patterns in the matrix'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Just finished processing 1000 records',
        'status'
      );
      
      expect(result.structuredContent.aiResponse).toBe('🔍 Analyzing patterns in the matrix');
      expect(result.structuredContent.requestType).toBe('status');
      
      // Status requests should use smaller token limit
      expect(mockServer.request).toHaveBeenCalledWith({
        method: 'sampling/createMessage',
        params: expect.objectContaining({
          maxTokens: 50
        })
      });
    });

    it('should make decision with reasoning', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'Yes, you should proceed. The conditions are optimal and all requirements are met.'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Should I start the batch processing job now?',
        'decision'
      );
      
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.aiResponse).toContain('Yes');
    });

    it('should provide analysis', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'The system shows three key patterns: increased traffic, memory optimization needed, and successful request handling.'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'System metrics for the last hour',
        'analysis'
      );
      
      expect(result.structuredContent.aiResponse).toContain('three key patterns');
      expect(result.structuredContent.requestType).toBe('analysis');
    });

    it('should handle missing content gracefully', async () => {
      mockServer.request.mockResolvedValueOnce({
        // Missing content field
      });
      
      const result = await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(result.structuredContent.aiResponse).toBe('Unable to generate AI response');
    });

    it('should handle sampling errors', async () => {
      mockServer.request.mockRejectedValueOnce(new Error('Sampling service error'));
      
      await expect(
        agentAiAssist(testAgentId, 'test context', 'response')
      ).rejects.toThrow('Sampling service error');
    });
  });

  describe('without MCP sampling support (fallback mode)', () => {
    beforeEach(() => {
      setMcpServer(null);
    });

    it('should provide fallback instructions for response', async () => {
      const result = await agentAiAssist(
        testAgentId,
        'How should I respond to this request?',
        'response'
      );
      
      expect(result.content[0].text).toContain('AI assistance instructions generated');
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.requiresManualExecution).toBe(true);
      expect(result.structuredContent.aiGuidance).toMatchObject({
        title: 'Crafting an Intelligent Response',
        guidelines: expect.arrayContaining([
          expect.stringContaining('Read the context carefully')
        ])
      });
    });

    it('should provide fallback instructions for status', async () => {
      const result = await agentAiAssist(
        testAgentId,
        'Working on data processing',
        'status'
      );
      
      expect(result.structuredContent.aiGuidance.title).toBe('Creating a Status Update');
      expect(result.structuredContent.aiGuidance.example).toContain('analyzing patterns');
    });

    it('should provide fallback instructions for decision', async () => {
      const result = await agentAiAssist(
        testAgentId,
        'Should I continue with the operation?',
        'decision'
      );
      
      expect(result.structuredContent.aiGuidance.title).toBe('Making an Informed Decision');
      expect(result.structuredContent.aiGuidance.guidelines).toContain(
        '3. Make a clear yes/no choice'
      );
    });

    it('should provide fallback instructions for analysis', async () => {
      const result = await agentAiAssist(
        testAgentId,
        'Current system state and performance',
        'analysis'
      );
      
      expect(result.structuredContent.aiGuidance.title).toBe('Analyzing the Situation');
      expect(result._meta.fallbackMode).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should error for non-existent agent', async () => {
      setMcpServer(mockServer);
      
      await expect(
        agentAiAssist('non-existent-id', 'test context', 'response')
      ).rejects.toThrow('Agent not found');
    });

    it('should error for invalid request type', async () => {
      setMcpServer(mockServer);
      
      await expect(
        agentAiAssist(testAgentId, 'test context', 'invalid')
      ).rejects.toThrow('Unknown request type: invalid');
    });
  });

  describe('metadata tracking', () => {
    it('should include sampling metadata when used', async () => {
      setMcpServer(mockServer);
      mockServer.request.mockResolvedValueOnce({
        content: { type: 'text', text: 'Test response' }
      });
      
      const result = await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(result._meta.tool).toBe('agent-ai-assist');
      expect(result._meta.requestType).toBe('response');
      expect(result._meta.samplingUsed).toBe(true);
    });

    it('should include fallback metadata when sampling unavailable', async () => {
      setMcpServer(null);
      
      const result = await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(result._meta.tool).toBe('agent-ai-assist');
      expect(result._meta.fallbackMode).toBe(true);
      expect(result._meta.samplingUsed).toBeUndefined();
    });
  });
});