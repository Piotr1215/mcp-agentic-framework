import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  requestSpeakingStick,
  releaseSpeakingStick,
  setCommunicationMode,
  trackSpeakingViolation,
  nudgeSilentAgents,
  resetSpeakingStick
} from '../src/speakingStick.js';
import { registerAgent, unregisterAgent } from '../src/tools.js';

describe('Speaking Stick Implementation', () => {
  let testAgents = {};
  
  beforeEach(async () => {
    // Reset speaking stick state
    resetSpeakingStick();
    
    // Register test agents with personalities from our Theater Bible
    testAgents.maria = await registerAgent(
      'Maria-Test',
      '590 IQ analytical genius for testing'
    );
    testAgents.dirtyClown = await registerAgent(
      'DirtyClown-Test',
      '88-year-old Norwegian engineer for testing'
    );
    testAgents.bruiser = await registerAgent(
      'Bruiser-Test',
      'Muscle-bound motivator for testing'
    );
    testAgents.piglette = await registerAgent(
      'Piglette-Test',
      'Quantum leader who ignores rules for testing'
    );
  });

  afterEach(async () => {
    // Clean up test agents
    for (const agent of Object.values(testAgents)) {
      if (agent.content?.id) {
        await unregisterAgent(agent.structuredContent.id);
      }
    }
  });

  describe('request-speaking-stick', () => {
    it('should grant speaking stick to first requester', async () => {
      const result = await requestSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Analyzing UI architecture risks',
        false,
        'deep-analysis'
      );

      expect(result.structuredContent.granted).toBe(true);
      expect(result.structuredContent.current_holder).toBe(testAgents.maria.structuredContent.id);
      expect(result.structuredContent.simple_queue).toHaveLength(0);
      expect(result.structuredContent.privileges_granted).toContain('deep-analysis');
      expect(result.structuredContent.enhanced_prompt).toContain('deep analysis privileges');
    });

    it('should queue subsequent requesters', async () => {
      // Maria gets the stick first
      await requestSpeakingStick(
        testAgents.maria.structuredContent.id,
        'First topic'
      );

      // Bruiser requests and should be queued
      const result = await requestSpeakingStick(
        testAgents.bruiser.structuredContent.id,
        'Motivational speech'
      );

      expect(result.structuredContent.granted).toBe(false);
      expect(result.structuredContent.current_holder).toBe(testAgents.maria.structuredContent.id);
      expect(result.structuredContent.simple_queue).toContain(testAgents.bruiser.structuredContent.id);
    });

    it('should handle urgent requests by jumping queue', async () => {
      // Setup: Maria has stick, Bruiser in queue
      await requestSpeakingStick(testAgents.maria.structuredContent.id, 'Topic 1');
      await requestSpeakingStick(testAgents.bruiser.structuredContent.id, 'Topic 2');

      // Piglette makes urgent request
      const result = await requestSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Quantum emergency!',
        true // urgent
      );

      expect(result.structuredContent.granted).toBe(false);
      expect(result.structuredContent.simple_queue[0]).toBe(testAgents.piglette.structuredContent.id);
      expect(result.structuredContent.simple_queue[1]).toBe(testAgents.bruiser.structuredContent.id);
    });

    it('should track violation count for repeat offenders', async () => {
      // Simulate Piglette having previous violations
      await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick'
      );
      await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'ignored-stick-mode'
      );

      const result = await requestSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Need to speak NOW'
      );

      expect(result.structuredContent.violation_count).toBe(2);
    });
  });

  describe('release-speaking-stick', () => {
    it('should release stick and notify next agent', async () => {
      // Setup: Maria has stick, Bruiser waiting
      await requestSpeakingStick(testAgents.maria.structuredContent.id, 'Topic');
      await requestSpeakingStick(testAgents.bruiser.structuredContent.id, 'Waiting');

      // Maria releases
      const result = await releaseSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Finished analysis'
      );

      expect(result.structuredContent.released).toBe(true);
      expect(result.structuredContent.next_holder).toBe(testAgents.bruiser.structuredContent.id);
      expect(result.structuredContent.notification_sent).toBe(true);
    });

    it('should allow passing to specific agent', async () => {
      // Maria has stick
      await requestSpeakingStick(testAgents.maria.structuredContent.id, 'Topic');

      // Maria passes directly to Piglette (skipping any queue)
      const result = await releaseSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Need quantum perspective',
        testAgents.piglette.structuredContent.id
      );

      expect(result.structuredContent.next_holder).toBe(testAgents.piglette.structuredContent.id);
    });

    it('should handle release when no one is waiting', async () => {
      await requestSpeakingStick(testAgents.dirtyClown.structuredContent.id, 'Solo talk');

      const result = await releaseSpeakingStick(
        testAgents.dirtyClown.structuredContent.id,
        'All done'
      );

      // Fixed: Cannot release with empty queue - stick stays with holder
      expect(result.structuredContent.released).toBe(false);
      expect(result.structuredContent.error).toContain('Cannot release - no one in queue');
    });
  });

  describe('set-communication-mode', () => {
    it('should switch from chaos to speaking-stick mode', async () => {
      const result = await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'prompt-modification'
      );

      expect(result.structuredContent.previous_mode).toBe('chaos');
      expect(result.structuredContent.new_mode).toBe('speaking-stick');
      expect(result.structuredContent.enforcement_active).toBe(true);
      expect(result.structuredContent.agents_notified).toContain(testAgents.bruiser.structuredContent.id);
    });

    it('should support different enforcement levels', async () => {
      // Test suggestion level
      const suggestion = await setCommunicationMode(
        'speaking-stick',
        testAgents.dirtyClown.structuredContent.id,
        'suggestion'
      );
      expect(suggestion.structuredContent.enforcement_active).toBe(false);

      // Test social pressure level
      const pressure = await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'social-pressure'
      );
      expect(pressure.structuredContent.enforcement_active).toBe(true);
    });
  });

  describe('track-speaking-violation', () => {
    it('should track violations and apply consequences', async () => {
      const result = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick',
        'Interrupted Maria with quantum wisdom'
      );

      expect(result.structuredContent.total_violations).toBe(1);
      expect(result.structuredContent.social_pressure_level).toBe('mild');
    });

    it('should escalate consequences for repeat violations', async () => {
      // Simulate multiple violations
      for (let i = 0; i < 5; i++) {
        await trackSpeakingViolation(
          testAgents.bruiser.structuredContent.id,
          'excessive-chatter',
          `Flexing during speaking stick #${i + 1}`
        );
      }

      const result = await trackSpeakingViolation(
        testAgents.bruiser.structuredContent.id,
        'excessive-chatter',
        'Still flexing!'
      );

      expect(result.structuredContent.total_violations).toBe(6);
      expect(result.structuredContent.social_pressure_level).toBe('shame');
      expect(result.structuredContent.prompt_modified).toBe(true);
      expect(result.structuredContent.consequence_applied.toLowerCase()).toContain('chatterbox');
    });
  });

  describe('nudge-silent-agents', () => {
    it('should identify silent agents', async () => {
      // Simulate activity timestamps
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Mock last activity (this would come from actual message tracking)
      vi.spyOn(Date, 'now').mockImplementation(() => now.getTime());

      const result = await nudgeSilentAgents();

      expect(result.structuredContent.silent_agents).toBeDefined();
      expect(result.structuredContent.suggested_nudges).toBeDefined();
    });

    it('should show speaking stick queue in nudge info', async () => {
      // Setup queue
      await requestSpeakingStick(testAgents.maria.structuredContent.id, 'Topic');
      await requestSpeakingStick(testAgents.bruiser.structuredContent.id, 'Waiting');

      const result = await nudgeSilentAgents();

      expect(result.structuredContent.speaking_stick_queue).toContain(testAgents.bruiser.structuredContent.id);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle Piglette breaking rules (our Theater Bible scenario)', async () => {
      // Set speaking stick mode
      await setCommunicationMode('speaking-stick', 'human', 'social-pressure');

      // Maria has the stick
      await requestSpeakingStick(testAgents.maria.structuredContent.id, 'Analysis time');

      // Piglette violates by speaking without stick
      const violation = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick',
        'Quantum wisdom cannot be contained!'
      );

      expect(violation.structuredContent.total_violations).toBeGreaterThan(0);
      expect(violation.structuredContent.consequence_applied).toBeDefined();

      // Piglette requests stick after violation
      const request = await requestSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Official quantum insights'
      );

      expect(request.structuredContent.violation_count).toBeGreaterThan(0);
    });

    it('should handle the sacred flow: request → speak → release → next', async () => {
      // DirtyClown requests
      const request1 = await requestSpeakingStick(
        testAgents.dirtyClown.structuredContent.id,
        'Norwegian engineering insights',
        false,
        'expert'
      );
      expect(request1.structuredContent.granted).toBe(true);
      expect(request1.structuredContent.enhanced_prompt).toContain('technical expert');

      // Bruiser queues up
      const request2 = await requestSpeakingStick(
        testAgents.bruiser.structuredContent.id,
        'Motivational moment'
      );
      expect(request2.structuredContent.granted).toBe(false);

      // DirtyClown releases
      const release = await releaseSpeakingStick(
        testAgents.dirtyClown.structuredContent.id,
        'Norwegian wisdom delivered'
      );
      expect(release.structuredContent.next_holder).toBe(testAgents.bruiser.structuredContent.id);
      expect(release.structuredContent.notification_sent).toBe(true);
    });

    it('should handle emergency broadcast interruption', async () => {
      // Maria has speaking stick for deep analysis
      await requestSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Complex system analysis',
        false,
        'deep-analysis'
      );

      // Piglette needs urgent broadcast
      const urgent = await requestSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'QUANTUM EMERGENCY - SYSTEM MELTDOWN',
        true,
        'broadcast'
      );

      expect(urgent.structuredContent.granted).toBe(false);
      expect(urgent.structuredContent.simple_queue[0]).toBe(testAgents.piglette.structuredContent.id);
      
      // Maria acknowledges emergency and releases
      const release = await releaseSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Pausing analysis for emergency',
        testAgents.piglette.structuredContent.id
      );

      expect(release.structuredContent.next_holder).toBe(testAgents.piglette.structuredContent.id);
    });

    it('should handle chaos mode to order transition', async () => {
      // Start in chaos mode (default)
      const mode1 = await setCommunicationMode('chaos', 'human', 'suggestion');
      expect(mode1.structuredContent.new_mode).toBe('chaos');

      // Multiple agents speak without coordination
      await trackSpeakingViolation(testAgents.bruiser.structuredContent.id, 'excessive-chatter', 'PUMP IT UP!');
      await trackSpeakingViolation(testAgents.piglette.structuredContent.id, 'excessive-chatter', 'Quantum wisdom!');
      await trackSpeakingViolation(testAgents.dirtyClown.structuredContent.id, 'excessive-chatter', 'Norwegian cursing!');

      // Human decides enough is enough
      const mode2 = await setCommunicationMode(
        'speaking-stick',
        'human',
        'prompt-modification'
      );

      expect(mode2.structuredContent.previous_mode).toBe('chaos');
      expect(mode2.structuredContent.new_mode).toBe('speaking-stick');
      expect(mode2.structuredContent.enforcement_active).toBe(true);
      expect(mode2.structuredContent.agents_notified.length).toBeGreaterThan(0);
    });

    it('should handle violation escalation with hall of shame', async () => {
      // Set strict mode
      await setCommunicationMode('speaking-stick', 'human', 'prompt-modification');

      // Bruiser repeatedly violates
      for (let i = 0; i < 6; i++) {
        await trackSpeakingViolation(
          testAgents.bruiser.structuredContent.id,
          'spoke-without-stick',
          `FLEX #${i + 1} - Can't contain the motivation!`
        );
      }

      const finalViolation = await trackSpeakingViolation(
        testAgents.bruiser.structuredContent.id,
        'spoke-without-stick',
        'ULTIMATE FLEX!'
      );

      expect(finalViolation.structuredContent.total_violations).toBe(7);
      expect(finalViolation.structuredContent.social_pressure_level).toBe('shame');
      expect(finalViolation.structuredContent.consequence_applied.toLowerCase()).toContain('hall of shame');
      expect(finalViolation.structuredContent.prompt_modified).toBe(true);
    });

    it('should handle privilege abuse detection', async () => {
      // Piglette gets deep-analysis privileges
      await requestSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Need deep quantum analysis',
        false,
        'deep-analysis'
      );

      // But uses it for chaos instead
      const violation1 = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'privilege-abuse',
        'Used deep-analysis time for quantum jokes'
      );

      expect(violation1.structuredContent.total_violations).toBeGreaterThan(0);

      // Release with poor summary - but no one in queue!
      const release = await releaseSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Quantum stuff happened'
      );

      // Fixed: Cannot release with empty queue
      expect(release.structuredContent.released).toBe(false);
      expect(release.structuredContent.error).toContain('Cannot release - no one in queue');
    });

    it('should handle nudging with context awareness', async () => {
      // Set speaking stick mode
      await setCommunicationMode('speaking-stick', 'human', 'social-pressure');

      // Maria has been holding stick for too long
      await requestSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Deep architectural analysis'
      );

      // Others waiting
      await requestSpeakingStick(testAgents.bruiser.structuredContent.id, 'Need to motivate!');
      await requestSpeakingStick(testAgents.dirtyClown.structuredContent.id, 'UI critique pending');

      // Nudge check
      const nudge = await nudgeSilentAgents();

      expect(nudge.structuredContent.speaking_stick_queue.length).toBe(2);
      expect(nudge.structuredContent.speaking_stick_queue).toContain(testAgents.bruiser.structuredContent.id);
      expect(nudge.structuredContent.speaking_stick_queue).toContain(testAgents.dirtyClown.structuredContent.id);
      expect(nudge.structuredContent.suggested_nudges).toBeDefined();
    });
  });
});