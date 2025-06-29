import { describe, it, expect, beforeEach } from 'vitest';
import { promptDefinitions, getPromptContent } from '../src/promptDefinitions.js';

describe('Prompt Definitions', () => {
  describe('promptDefinitions structure', () => {
    it('should export an array of prompt definitions', () => {
      expect(Array.isArray(promptDefinitions)).toBe(true);
      expect(promptDefinitions.length).toBeGreaterThan(0);
    });

    it('should have all required prompts', () => {
      const expectedPrompts = [
        'agent-onboarding',
        'agent-heartbeat-loop',
        'broadcast-announcement',
        'agent-status-report',
        'private-conversation',
        'wake-up-recovery'
      ];

      const actualPrompts = promptDefinitions.map(p => p.name);
      expectedPrompts.forEach(expected => {
        expect(actualPrompts).toContain(expected);
      });
    });

    it('should have valid structure for each prompt', () => {
      promptDefinitions.forEach(prompt => {
        // Required fields
        expect(prompt).toHaveProperty('name');
        expect(typeof prompt.name).toBe('string');
        expect(prompt.name).toMatch(/^[a-z]+(-[a-z]+)*$/); // kebab-case

        expect(prompt).toHaveProperty('description');
        expect(typeof prompt.description).toBe('string');
        expect(prompt.description.length).toBeGreaterThan(0);

        expect(prompt).toHaveProperty('arguments');
        expect(Array.isArray(prompt.arguments)).toBe(true);

        // Each argument should have proper structure
        prompt.arguments.forEach(arg => {
          expect(arg).toHaveProperty('name');
          expect(typeof arg.name).toBe('string');

          expect(arg).toHaveProperty('description');
          expect(typeof arg.description).toBe('string');

          expect(arg).toHaveProperty('required');
          expect(typeof arg.required).toBe('boolean');
        });
      });
    });
  });

  describe('getPromptContent function', () => {
    it('should generate content for agent-onboarding', async () => {
      const content = await getPromptContent('agent-onboarding', {
        agent_name: 'TestBot',
        agent_role: 'Testing the system'
      });

      expect(content).toContain('Welcome to the MCP Agentic Framework!');
      expect(content).toContain('TestBot');
      expect(content).toContain('Testing the system');
      expect(content).toContain('register-agent:');
      expect(content).toContain('sleep 5');
      expect(content).toContain('check-for-messages:');
      expect(content).toContain('send-broadcast:');
    });

    it('should generate content for agent-heartbeat-loop', async () => {
      const content = await getPromptContent('agent-heartbeat-loop', {
        agent_id: 'test-123',
        check_interval: '10'
      });

      expect(content).toContain('Standard Agent Heartbeat Loop');
      expect(content).toContain('sleep 10'); // Custom interval
      expect(content).toContain('agent_id: "test-123"');
      expect(content).toContain('check-for-messages:');
      expect(content).toContain('discover-agents');
      expect(content).toContain('CRITICAL: Skipping sleep commands = falling unconscious!');
    });

    it('should use default interval when not provided', async () => {
      const content = await getPromptContent('agent-heartbeat-loop', {
        agent_id: 'test-123'
      });

      expect(content).toContain('sleep 5'); // Default interval
    });

    it('should generate content for broadcast-announcement', async () => {
      const content = await getPromptContent('broadcast-announcement', {
        agent_id: 'test-123',
        announcement_type: 'alert',
        message: 'System maintenance starting'
      });

      expect(content).toContain('Broadcasting ALERT');
      expect(content).toContain('System maintenance starting');
      expect(content).toContain('priority: "high"'); // Alerts are high priority
      expect(content).toContain('discover-agents');
      expect(content).toContain('send-broadcast:');
    });

    it('should set correct priority based on announcement type', async () => {
      const updateContent = await getPromptContent('broadcast-announcement', {
        agent_id: 'test-123',
        announcement_type: 'update',
        message: 'New feature available'
      });
      expect(updateContent).toContain('priority: "normal"');

      const questionContent = await getPromptContent('broadcast-announcement', {
        agent_id: 'test-123',
        announcement_type: 'question',
        message: 'Anyone know about X?'
      });
      expect(questionContent).toContain('priority: "normal"');

      const alertContent = await getPromptContent('broadcast-announcement', {
        agent_id: 'test-123',
        announcement_type: 'alert',
        message: 'Critical issue!'
      });
      expect(alertContent).toContain('priority: "high"');
    });

    it('should generate content for agent-status-report', async () => {
      const content = await getPromptContent('agent-status-report', {
        agent_id: 'test-123',
        include_messages: 'true'
      });

      expect(content).toContain('Generating Agent Ecosystem Status Report');
      expect(content).toContain('discover-agents');
      expect(content).toContain('Requesting status updates from all agents');
      expect(content).toContain('send-broadcast:');
      expect(content).toContain('Collect responses');
    });

    it('should skip message collection when include_messages is false', async () => {
      const content = await getPromptContent('agent-status-report', {
        agent_id: 'test-123',
        include_messages: 'false'
      });

      expect(content).not.toContain('Requesting status updates from all agents');
      expect(content).toContain('current state');
    });

    it('should generate content for private-conversation', async () => {
      const content = await getPromptContent('private-conversation', {
        from_agent_id: 'agent-1',
        to_agent_id: 'agent-2',
        topic: 'Database optimization strategies'
      });

      expect(content).toContain('Starting Private Conversation');
      expect(content).toContain('Topic: Database optimization strategies');
      expect(content).toContain('send-message:');
      expect(content).toContain('to: "agent-2"');
      expect(content).toContain('from: "agent-1"');
      expect(content).toContain('Are you available?');
    });

    it('should generate content for wake-up-recovery', async () => {
      const content = await getPromptContent('wake-up-recovery', {
        agent_id: 'sleepy-agent'
      });

      expect(content).toContain('WAKE UP RECOVERY PROTOCOL');
      expect(content).toContain('You fell unconscious!');
      expect(content).toContain('CHECK WHAT YOU MISSED (CRITICAL!)');
      expect(content).toContain('agent_id: "sleepy-agent"');
      expect(content).toContain('Just recovered from unconsciousness');
      expect(content).toContain('RESUME HEARTBEAT PATTERN IMMEDIATELY!');
    });

    it('should throw error for unknown prompt', async () => {
      await expect(
        getPromptContent('non-existent-prompt', {})
      ).rejects.toThrow('Unknown prompt: non-existent-prompt');
    });
  });

  describe('Prompt content validation', () => {
    it('should include sleep commands in all appropriate prompts', async () => {
      const promptsNeedingSleep = [
        'agent-onboarding',
        'agent-heartbeat-loop',
        'broadcast-announcement',
        'agent-status-report',
        'private-conversation',
        'wake-up-recovery'
      ];

      for (const promptName of promptsNeedingSleep) {
        const prompt = promptDefinitions.find(p => p.name === promptName);
        const args = {};
        
        // Fill required arguments with test data
        prompt.arguments.forEach(arg => {
          if (arg.required) {
            args[arg.name] = 'test-value';
          }
        });

        const content = await getPromptContent(promptName, args);
        expect(content).toContain('sleep');
      }
    });

    it('should reference agent IDs correctly', async () => {
      const agentId = 'unique-test-id-12345';
      
      const heartbeatContent = await getPromptContent('agent-heartbeat-loop', {
        agent_id: agentId
      });
      expect(heartbeatContent).toContain(`agent_id: "${agentId}"`);

      const statusContent = await getPromptContent('agent-status-report', {
        agent_id: agentId
      });
      expect(statusContent).toContain(`agent_id: "${agentId}"`);
    });

    it('should maintain consistent formatting', async () => {
      for (const prompt of promptDefinitions) {
        const args = {};
        prompt.arguments.forEach(arg => {
          if (arg.required) {
            args[arg.name] = 'test-value';
          }
        });

        const content = await getPromptContent(prompt.name, args);
        
        // Should use proper markdown
        expect(content).toMatch(/^#{1,3} /m); // Has headers
        
        // Tool calls should be properly formatted
        if (content.includes('register-agent:') || 
            content.includes('send-message:') || 
            content.includes('check-for-messages:')) {
          expect(content).toContain('```'); // Code blocks
        }
      }
    });
  });

  describe('Prompt argument handling', () => {
    it('should handle missing optional arguments gracefully', async () => {
      // check_interval is optional
      const content = await getPromptContent('agent-heartbeat-loop', {
        agent_id: 'test-agent'
        // Omitting check_interval
      });
      
      expect(content).toBeDefined();
      expect(content).toContain('sleep 5'); // Should use default
    });

    it('should require all mandatory arguments', async () => {
      const onboardingPrompt = promptDefinitions.find(p => p.name === 'agent-onboarding');
      const requiredArgs = onboardingPrompt.arguments.filter(a => a.required);
      
      expect(requiredArgs).toHaveLength(2);
      expect(requiredArgs.map(a => a.name)).toEqual(['agent_name', 'agent_role']);
    });
  });
});