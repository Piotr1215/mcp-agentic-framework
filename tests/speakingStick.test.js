import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  grantSpeakingStickTo,
  requestSpeakingStick,
  releaseSpeakingStick,
  setCommunicationMode,
  trackSpeakingViolation,
  nudgeSilentAgents,
  resetSpeakingStick,
  getSpeakingStickStatus
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

  describe('grant-speaking-stick-to', () => {
    it('should allow ruler to grant speaking stick', async () => {
      // Maria becomes ruler by setting speaking-stick mode
      await setCommunicationMode(
        'speaking-stick', 
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Maria grants stick to Bruiser
      const result = await grantSpeakingStickTo(
        testAgents.maria.structuredContent.id,
        testAgents.bruiser.structuredContent.id,
        'Testing ruler grant'
      );
      
      expect(result.structuredContent.granted).toBe(true);
      expect(result.structuredContent.current_holder).toBe(testAgents.bruiser.structuredContent.id);
    });
    
    it('should reject grant from non-ruler', async () => {
      // Maria becomes ruler
      await setCommunicationMode(
        'speaking-stick', 
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Bruiser tries to grant (should fail)
      const result = await grantSpeakingStickTo(
        testAgents.bruiser.structuredContent.id,
        testAgents.piglette.structuredContent.id,
        'Invalid grant attempt'
      );
      
      expect(result.structuredContent.error).toBe('not_ruler');
    });
  });

  describe('request-speaking-stick', () => {
    it('should return deprecated message', async () => {
      const result = await requestSpeakingStick(
        testAgents.maria.structuredContent.id,
        'Testing deprecated method'
      );
      
      expect(result.structuredContent.error).toBe('deprecated');
    });
  });

  describe('release-speaking-stick', () => {
    it('should return stick to ruler', async () => {
      // Maria becomes ruler
      await setCommunicationMode(
        'speaking-stick', 
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Maria grants to Bruiser
      await grantSpeakingStickTo(
        testAgents.maria.structuredContent.id,
        testAgents.bruiser.structuredContent.id
      );
      
      // Bruiser releases - should return to Maria
      const result = await releaseSpeakingStick(
        testAgents.bruiser.structuredContent.id,
        'Done speaking'
      );
      
      expect(result.structuredContent.released).toBe(true);
      expect(result.structuredContent.returned_to_ruler).toBe(true);
      expect(result.structuredContent.ruler).toBe(testAgents.maria.structuredContent.id);
    });
    
    it('should reject release from non-holder', async () => {
      await setCommunicationMode(
        'speaking-stick', 
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      const result = await releaseSpeakingStick(
        testAgents.piglette.structuredContent.id,
        'Invalid release'
      );
      
      expect(result.structuredContent.released).toBe(false);
      expect(result.content[0].text).toContain('do not hold the speaking stick');
    });
  });

  describe('set-communication-mode', () => {
    it('should set initiator as ruler in speaking-stick mode', async () => {
      const result = await setCommunicationMode(
        'speaking-stick',
        testAgents.dirtyClown.structuredContent.id,
        'suggestion'
      );
      
      expect(result.structuredContent.new_mode).toBe('speaking-stick');
      expect(result.structuredContent.ruler).toBe(testAgents.dirtyClown.structuredContent.id);
      expect(result.structuredContent.current_holder).toBe(testAgents.dirtyClown.structuredContent.id);
    });
    
    it('should clear ruler when switching to chaos', async () => {
      // First set speaking-stick
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Then switch to chaos
      const result = await setCommunicationMode(
        'chaos',
        testAgents.bruiser.structuredContent.id,
        'suggestion'
      );
      
      expect(result.structuredContent.new_mode).toBe('chaos');
      expect(result.structuredContent.ruler).toBe(null);
    });
  });

  describe('get-speaking-stick-status', () => {
    it('should show ruler information', async () => {
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      const status = await getSpeakingStickStatus();
      
      expect(status.structuredContent.ruler).toBe(testAgents.maria.structuredContent.id);
      expect(status.structuredContent.ruler_name).toBe('Maria-Test');
      expect(status.structuredContent.mode).toBe('speaking-stick');
    });
  });

  describe('track-speaking-violation', () => {
    it('should track violations', async () => {
      const result = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick',
        'Testing violation tracking'
      );
      
      expect(result.structuredContent.total_violations).toBe(1);
    });
    
    it('should escalate consequences for repeat violations', async () => {
      // Track multiple violations
      for (let i = 0; i < 3; i++) {
        await trackSpeakingViolation(
          testAgents.piglette.structuredContent.id,
          'spoke-without-stick'
        );
      }
      
      const result = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick'
      );
      
      expect(result.structuredContent.total_violations).toBe(4);
      expect(result.structuredContent.social_pressure_level).toBe('mild'); // 4 violations is still mild
    });
  });

  describe('nudge-silent-agents', () => {
    it('should identify silent agents', async () => {
      // Fast-forward time simulation
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00'));
      
      // Set speaking-stick mode
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Fast forward 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);
      
      const result = await nudgeSilentAgents();
      
      // Should find silent agents (all except Maria who just set the mode)
      expect(result.structuredContent.silent_agents.length).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle ruler granting flow', async () => {
      // Maria becomes ruler
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'suggestion'
      );
      
      // Maria grants to DirtyClown
      const grant1 = await grantSpeakingStickTo(
        testAgents.maria.structuredContent.id,
        testAgents.dirtyClown.structuredContent.id,
        'Explain your UI design'
      );
      expect(grant1.structuredContent.granted).toBe(true);
      
      // DirtyClown releases
      const release1 = await releaseSpeakingStick(
        testAgents.dirtyClown.structuredContent.id,
        'UI explanation complete'
      );
      expect(release1.structuredContent.returned_to_ruler).toBe(true);
      
      // Maria grants to Bruiser
      const grant2 = await grantSpeakingStickTo(
        testAgents.maria.structuredContent.id,
        testAgents.bruiser.structuredContent.id,
        'Share your motivation'
      );
      expect(grant2.structuredContent.granted).toBe(true);
    });
    
    it('should handle violations and enforcement', async () => {
      await setCommunicationMode(
        'speaking-stick',
        testAgents.maria.structuredContent.id,
        'social-pressure'
      );
      
      // Track Piglette breaking rules
      const violation = await trackSpeakingViolation(
        testAgents.piglette.structuredContent.id,
        'spoke-without-stick',
        'Quantum leader ignores protocol'
      );
      
      expect(violation.structuredContent.total_violations).toBeGreaterThan(0);
    });
  });
});