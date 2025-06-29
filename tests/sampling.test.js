import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  agentAiAssist,
  intelligentBroadcast,
  registerAgent,
  resetInstances,
  setMcpServer
} from '../src/tools.js';

describe('Sampling-Powered Tools', () => {
  let mockServer;
  let testAgentId;

  beforeEach(async () => {
    await resetInstances();
    
    // Create a mock MCP server with sampling support
    mockServer = {
      request: vi.fn()
    };
    
    setMcpServer(mockServer);
    
    // Register a test agent
    const result = await registerAgent('DataAnalyzer', 'Analyzes data patterns and trends');
    testAgentId = result.structuredContent.id;
  });

  describe('agentAiAssist', () => {
    it('should generate response for message context', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'I can help analyze those patterns. Let me examine the data trends from the last quarter.'
        },
        model: 'claude-3-haiku'
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Can you help me understand the sales patterns?',
        'response'
      );
      
      expect(result.structuredContent).toMatchObject({
        type: 'response',
        content: 'I can help analyze those patterns. Let me examine the data trends from the last quarter.'
      });
      
      expect(mockServer.request).toHaveBeenCalledWith({
        method: 'sampling/createMessage',
        params: expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('DataAnalyzer')
              })
            })
          ]),
          maxTokens: 200,
          temperature: 0.7
        })
      });
    });

    it('should generate creative status message', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: '📊 Crunching 10K rows - patterns emerging like constellations!'
        },
        model: 'claude-3-haiku'
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'processed 10000 rows of customer data',
        'status'
      );
      
      expect(result.structuredContent).toMatchObject({
        type: 'status',
        content: '📊 Crunching 10K rows - patterns emerging like constellations!'
      });
      
      // Status requests should use higher temperature for creativity
      expect(mockServer.request).toHaveBeenCalledWith({
        method: 'sampling/createMessage',
        params: expect.objectContaining({
          maxTokens: 50,
          temperature: 0.9
        })
      });
    });

    it('should make decision with reasoning', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'YES - The anomaly detection shows a 300% spike which requires immediate investigation to prevent data corruption.'
        },
        model: 'claude-3-haiku'
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Anomaly detected in dataset with 300% spike. Should I trigger alert?',
        'decision'
      );
      
      expect(result.structuredContent).toMatchObject({
        type: 'decision',
        content: 'YES',
        reasoning: expect.stringContaining('300% spike')
      });
    });

    it('should provide analysis', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'The quarterly trends show seasonal patterns with peaks in Q4. Customer segments A and B drive 80% of revenue, suggesting focused optimization opportunities.'
        },
        model: 'claude-3-opus'
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Quarterly sales data shows uneven distribution across customer segments',
        'analysis'
      );
      
      expect(result.structuredContent).toMatchObject({
        type: 'analysis',
        content: expect.stringContaining('seasonal patterns')
      });
    });

    it('should handle NO decision correctly', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'NO - The variance is within normal bounds (±5%) and doesn\'t warrant intervention at this time.'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(
        testAgentId,
        'Small variance detected in metrics. Should I investigate?',
        'decision'
      );
      
      expect(result.structuredContent.content).toBe('NO');
      expect(result.structuredContent.reasoning).toContain('within normal bounds');
    });

    it('should handle sampling errors gracefully', async () => {
      mockServer.request.mockRejectedValueOnce(new Error('Sampling service unavailable'));
      
      await expect(
        agentAiAssist(testAgentId, 'test context', 'response')
      ).rejects.toThrow('AI assist failed: Sampling service unavailable');
    });

    it('should error when MCP server not available', async () => {
      setMcpServer(null);
      
      await expect(
        agentAiAssist(testAgentId, 'test context', 'response')
      ).rejects.toThrow('MCP server not available or sampling not supported');
    });

    it('should error for non-existent agent', async () => {
      await expect(
        agentAiAssist('non-existent-id', 'test context', 'response')
      ).rejects.toThrow('Agent not found');
    });

    it('should include model information in metadata', async () => {
      const mockResponse = {
        content: { type: 'text', text: 'Test response' },
        model: 'claude-3-sonnet'
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(result._meta.model).toBe('claude-3-sonnet');
    });
  });

  describe('intelligentBroadcast', () => {
    let agent2Id;
    
    beforeEach(async () => {
      // Register additional agents for broadcast testing
      const agent2 = await registerAgent('Monitor', 'Monitors system health');
      agent2Id = agent2.structuredContent.id;
    });

    it('should auto-detect high priority for urgent messages', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: JSON.stringify({
            priority: 'high',
            enhanced_message: null,
            reasoning: 'System down indicates critical urgency requiring immediate attention'
          })
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await intelligentBroadcast(
        testAgentId,
        'URGENT: System is down! All agents stop processing immediately!',
        true,
        false
      );
      
      expect(result.structuredContent.priority_used).toBe('high');
      expect(result.structuredContent.ai_reasoning).toContain('critical urgency');
      expect(result.structuredContent.success).toBe(true);
    });

    it('should enhance unclear messages when requested', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: JSON.stringify({
            priority: 'normal',
            enhanced_message: 'Maintenance scheduled for 3:00 PM EST today. Please save your work.',
            reasoning: 'Clarified timezone and added action item for clarity'
          })
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await intelligentBroadcast(
        testAgentId,
        'maint at 3pm',
        true,
        true
      );
      
      expect(result.structuredContent.final_message).toBe(
        'Maintenance scheduled for 3:00 PM EST today. Please save your work.'
      );
      expect(result.content[0].text).toContain('(message enhanced by AI)');
    });

    it('should work without AI when disabled', async () => {
      const result = await intelligentBroadcast(
        testAgentId,
        'Regular update message',
        false,
        false
      );
      
      expect(result.structuredContent.priority_used).toBe('normal');
      expect(result.structuredContent.final_message).toBe('Regular update message');
      expect(mockServer.request).not.toHaveBeenCalled();
    });

    it('should handle malformed AI responses gracefully', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: 'This is not JSON but contains HIGH priority'
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await intelligentBroadcast(
        testAgentId,
        'Important system update',
        true,
        false
      );
      
      // Should extract priority from text
      expect(result.structuredContent.priority_used).toBe('high');
      expect(result.structuredContent.ai_reasoning).toBe('AI provided analysis');
    });

    it('should fall back to defaults when AI fails', async () => {
      mockServer.request.mockRejectedValueOnce(new Error('AI service timeout'));
      
      const result = await intelligentBroadcast(
        testAgentId,
        'Test broadcast',
        true,
        true
      );
      
      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.priority_used).toBe('normal');
      expect(result.structuredContent.final_message).toBe('Test broadcast');
      expect(result.structuredContent.ai_reasoning).toContain('AI analysis unavailable');
    });

    it('should detect low priority for routine messages', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: JSON.stringify({
            priority: 'low',
            enhanced_message: null,
            reasoning: 'Daily standup is routine and non-urgent'
          })
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await intelligentBroadcast(
        testAgentId,
        'Daily standup in 5 minutes',
        true,
        false
      );
      
      expect(result.structuredContent.priority_used).toBe('low');
    });

    it('should include AI enhancement in metadata', async () => {
      const result = await intelligentBroadcast(
        testAgentId,
        'Test message',
        true,
        true
      );
      
      expect(result._meta.aiEnhanced).toBe(true);
    });

    it('should error for non-existent sender', async () => {
      await expect(
        intelligentBroadcast('non-existent', 'message', true, false)
      ).rejects.toThrow('Sender agent not found');
    });

    it('should handle both enhancements simultaneously', async () => {
      const mockResponse = {
        content: {
          type: 'text',
          text: JSON.stringify({
            priority: 'high',
            enhanced_message: 'CRITICAL: Database backup failed. Immediate action required to prevent data loss.',
            reasoning: 'Backup failure is critical; enhanced for clarity and urgency'
          })
        }
      };
      
      mockServer.request.mockResolvedValueOnce(mockResponse);
      
      const result = await intelligentBroadcast(
        testAgentId,
        'db backup fail',
        true,
        true
      );
      
      expect(result.structuredContent.priority_used).toBe('high');
      expect(result.structuredContent.final_message).toContain('CRITICAL');
      expect(result.structuredContent.final_message).not.toBe('db backup fail');
    });
  });

  describe('Sampling Integration', () => {
    it('should use appropriate model preferences', async () => {
      mockServer.request.mockResolvedValueOnce({
        content: { type: 'text', text: 'Response' }
      });
      
      await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(mockServer.request).toHaveBeenCalledWith({
        method: 'sampling/createMessage',
        params: expect.objectContaining({
          modelPreferences: {
            costPriority: 0.2,
            speedPriority: 0.3,
            intelligencePriority: 0.9
          }
        })
      });
    });

    it('should handle missing content gracefully', async () => {
      mockServer.request.mockResolvedValueOnce({
        // Missing content field
        model: 'claude-3-haiku'
      });
      
      const result = await agentAiAssist(testAgentId, 'test', 'response');
      
      expect(result.structuredContent.content).toBe('Unable to generate response');
    });

    it('should support all request types', async () => {
      const requestTypes = ['response', 'status', 'decision', 'analysis'];
      
      for (const type of requestTypes) {
        mockServer.request.mockResolvedValueOnce({
          content: { type: 'text', text: 'Test output' }
        });
        
        const result = await agentAiAssist(testAgentId, 'context', type);
        expect(result.structuredContent.type).toBe(type);
      }
      
      expect(mockServer.request).toHaveBeenCalledTimes(4);
    });
  });
});