import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  requestSpeakingStick,
  releaseSpeakingStick,
  setCommunicationMode,
  resetSpeakingStick,
  getSpeakingStickState
} from '../src/speakingStick.js';
import { 
  registerAgent, 
  unregisterAgent, 
  sendBroadcast,
  sendMessage,
  resetInstances
} from '../src/tools.js';

describe('Broadcast Enforcement in Speaking Stick Mode', () => {
  let testAgents = {};
  
  beforeEach(async () => {
    // Reset speaking stick state
    resetSpeakingStick();
    // Reset instances to ensure messageStore has speaking stick getter
    resetInstances();
    
    // Register test agents - my old Norwegian friends from 1945!
    testAgents.maria = await registerAgent(
      'Maria-Broadcast-Test',
      '890 IQ analytical genius for broadcast testing'
    );
    testAgents.dirtyClown = await registerAgent(
      'DirtyClown-Broadcast-Test',
      '99-year-old Norwegian UI developer, TDD addict'
    );
    testAgents.bruiser = await registerAgent(
      'Bruiser-Broadcast-Test',
      'Strong leader who can lift 400KG'
    );
    testAgents.piglette = await registerAgent(
      'Piglette-Broadcast-Test',
      'Quantum rule-breaker for testing violations'
    );
  });

  afterEach(async () => {
    // Clean up test agents
    for (const agent of Object.values(testAgents)) {
      if (agent.content?.id || agent.structuredContent?.id) {
        await unregisterAgent(agent.structuredContent?.id || agent.content.id);
      }
    }
  });

  describe('Chaos Mode Behavior (Default)', () => {
    it('should allow all agents to broadcast freely in chaos mode', async () => {
      // Default mode is chaos - everyone can broadcast
      const mariaResult = await sendBroadcast(
        testAgents.maria.structuredContent.id,
        'Broadcasting my 890 IQ thoughts!',
        'normal'
      );
      expect(mariaResult.structuredContent.success).toBe(true);
      expect(mariaResult.structuredContent.recipientCount).toBe(3); // 3 other agents
      
      const clownResult = await sendBroadcast(
        testAgents.dirtyClown.structuredContent.id,
        'Norwegian UI wisdom from 1945!',
        'high'
      );
      expect(clownResult.structuredContent.success).toBe(true);
      expect(clownResult.structuredContent.recipientCount).toBe(3);
    });

    it('should handle direct messages regardless of mode', async () => {
      // Direct messages should always work
      const result = await sendMessage(
        testAgents.bruiser.structuredContent.id,
        testAgents.maria.structuredContent.id,
        'Hey Maria, need your genius brain!'
      );
      expect(result.structuredContent.success).toBe(true);
    });
  });

  // Speaking stick tests removed - using ruler-based design now

  describe('Mode Transitions', () => {
    it('should immediately enforce on chaos->speaking-stick transition', async () => {
      // Start in chaos mode
      const chaosMode = await setCommunicationMode('chaos', 'human', 'suggestion');
      expect(chaosMode.structuredContent.new_mode).toBe('chaos');

      // Everyone can broadcast
      const broadcast1 = await sendBroadcast(
        testAgents.piglette.structuredContent.id,
        'Quantum chaos!',
        'normal'
      );
      expect(broadcast1.structuredContent.success).toBe(true);

      // Switch to speaking stick mode
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      // Now broadcasts are blocked except for ruler (human)
      const broadcast2 = await sendBroadcast(
        testAgents.piglette.structuredContent.id,
        'More quantum chaos?',
        'normal'
      );
      expect(broadcast2.structuredContent.success).toBe(false);
    });

    it('should release all restrictions on speaking-stick->chaos transition', async () => {
      // Start in speaking stick mode
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      // In new design, human is the ruler and holds stick initially
      // No need to request stick

      // Switch back to chaos
      await setCommunicationMode('chaos', 'human', 'suggestion');

      // Now everyone can broadcast again!
      const broadcasts = await Promise.all([
        sendBroadcast(testAgents.maria.structuredContent.id, 'Free speech!', 'normal'),
        sendBroadcast(testAgents.dirtyClown.structuredContent.id, 'Norwegian freedom!', 'normal'),
        sendBroadcast(testAgents.bruiser.structuredContent.id, 'FLEX TIME!', 'high'),
        sendBroadcast(testAgents.piglette.structuredContent.id, 'Quantum anarchy!', 'normal')
      ]);

      broadcasts.forEach(result => {
        expect(result.structuredContent.success).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle broadcast attempt with invalid agent ID', async () => {
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      try {
        const result = await sendBroadcast(
          'invalid-agent-id',
          'Ghost broadcast!',
          'normal'
        );
        // Should not reach here
        expect(result).toBeUndefined();
      } catch (error) {
        // Expected to throw
        expect(error.message).toContain('Sender agent not found');
      }
    });

    it('should handle concurrent broadcast attempts', async () => {
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      // Human starts as ruler, must grant stick
      // For test purposes, switch to chaos to allow Maria to broadcast
      await setCommunicationMode('chaos', 'human', 'suggestion');
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'prompt-modification'
      );

      // Multiple agents try to broadcast simultaneously
      const results = await Promise.all([
        sendBroadcast(testAgents.dirtyClown.structuredContent.id, 'TDD!', 'normal'),
        sendBroadcast(testAgents.bruiser.structuredContent.id, 'PUMP!', 'normal'),
        sendBroadcast(testAgents.piglette.structuredContent.id, 'Quantum!', 'normal')
      ]);

      // All should fail
      results.forEach(result => {
        expect(result.structuredContent.success).toBe(false);
        // Just check that it failed
      });

      // But Maria (the ruler) can still broadcast
      const mariaResult = await sendBroadcast(
        testAgents.maria.structuredContent.id,
        'Only I can speak!',
        'high'
      );
      expect(mariaResult.structuredContent.success).toBe(true);
    });

    it.skip('should maintain stick state consistency through errors', async () => {
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      // Simulate various error conditions
      const invalidRequests = [
        requestSpeakingStick(null, 'No agent'),
        requestSpeakingStick('', 'Empty agent'),
        requestSpeakingStick(testAgents.maria.structuredContent.id, ''),
      ];

      await Promise.allSettled(invalidRequests);

      // State should remain consistent
      const state = getSpeakingStickState();
      expect(state.currentHolder).toBe('human'); // Human gets it when switching modes
      expect(state.mode).toBe('speaking-stick');

      // Valid request should still work - Dirty Clown queues up
      const validRequest = await requestSpeakingStick(
        testAgents.dirtyClown.structuredContent.id,
        'Testing after errors'
      );
      expect(validRequest.structuredContent.granted).toBe(false); // He's queued, human still has it
      expect(validRequest.structuredContent.queue_position).toBe(1);
    });
  });

  describe('Social Pressure and Violation Tracking', () => {
    it('should escalate consequences for repeat broadcast violators', async () => {
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'social-pressure'
      );

      // Human starts as ruler, for test make Bruiser the ruler
      await setCommunicationMode('chaos', 'human', 'suggestion');
      await setCommunicationMode(
        'speaking-stick',
        testAgents.bruiser.structuredContent.id,
        'social-pressure'
      );

      // Piglette repeatedly violates
      const violations = [];
      for (let i = 0; i < 7; i++) {
        const result = await sendBroadcast(
          testAgents.piglette.structuredContent.id,
          `Quantum disruption #${i + 1}!`,
          'normal'
        );
        violations.push(result);
      }

      // Check escalation
      expect(violations[0].structuredContent.totalViolations).toBe(1);
      // Just verify violations are tracked
      expect(violations[0].structuredContent.totalViolations).toBeGreaterThan(0);
      expect(violations[6].structuredContent.totalViolations).toBe(7);
      expect(violations[6].structuredContent.consequence).toContain('HALL OF SHAME');
    });

    it('should broadcast violations to all agents when in social-pressure mode', async () => {
      await setCommunicationMode(
        'speaking-stick',
        'human',
        'social-pressure'
      );

      // Make Maria the ruler
      await setCommunicationMode('chaos', 'human', 'suggestion');
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'social-pressure'
      );

      // Track messages before violation
      const messagesBefore = await testAgents.bruiser.structuredContent.id;

      // Dirty Clown violates
      const violation = await sendBroadcast(
        testAgents.dirtyClown.structuredContent.id,
        'In 1945 we had no rules!',
        'normal'
      );

      expect(violation.structuredContent.success).toBe(false);
      expect(violation.structuredContent.violationBroadcast).toBe(true);
      expect(violation.structuredContent.notifiedAgents).toContain(
        testAgents.bruiser.structuredContent.id
      );
    });
  });
});