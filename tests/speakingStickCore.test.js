import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  requestSpeakingStick,
  releaseSpeakingStick,
  setCommunicationMode,
  resetSpeakingStick,
  getSpeakingStickState,
  getSpeakingStickStatus
} from '../src/speakingStick.js';
import { 
  registerAgent, 
  unregisterAgent, 
  sendBroadcast,
  resetInstances
} from '../src/tools.js';

describe('Speaking Stick Core Functionality', () => {
  let testAgents = {};
  
  beforeEach(async () => {
    // Reset everything
    resetSpeakingStick();
    resetInstances();
    
    // Register test agents
    testAgents.agent1 = await registerAgent('Agent1', 'Test agent 1');
    testAgents.agent2 = await registerAgent('Agent2', 'Test agent 2');
    testAgents.agent3 = await registerAgent('Agent3', 'Test agent 3');
  });

  afterEach(async () => {
    // Clean up
    for (const agent of Object.values(testAgents)) {
      if (agent.structuredContent?.id) {
        await unregisterAgent(agent.structuredContent.id);
      }
    }
  });

  describe('Core Enforcement', () => {
    it('should enforce broadcast restrictions in speaking-stick mode', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Agent1 gets the stick
      const stick = await requestSpeakingStick(
        testAgents.agent1.structuredContent.id,
        'Test topic'
      );
      expect(stick.structuredContent.granted).toBe(true);

      // Agent1 can broadcast
      const broadcast1 = await sendBroadcast(
        testAgents.agent1.structuredContent.id,
        'I have the stick',
        'normal'
      );
      expect(broadcast1.structuredContent.success).toBe(true);

      // Agent2 cannot broadcast
      const broadcast2 = await sendBroadcast(
        testAgents.agent2.structuredContent.id,
        'I do not have the stick',
        'normal'
      );
      expect(broadcast2.structuredContent.success).toBe(false);
    });

    it('should allow all broadcasts in chaos mode', async () => {
      // Default is chaos mode
      const state = getSpeakingStickState();
      expect(state.mode).toBe('chaos');

      // Both agents can broadcast
      const broadcast1 = await sendBroadcast(
        testAgents.agent1.structuredContent.id,
        'Chaos message 1',
        'normal'
      );
      const broadcast2 = await sendBroadcast(
        testAgents.agent2.structuredContent.id,
        'Chaos message 2',
        'normal'
      );

      expect(broadcast1.structuredContent.success).toBe(true);
      expect(broadcast2.structuredContent.success).toBe(true);
    });
  });

  describe('Queue Management', () => {
    it('should maintain proper queue order', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Agent1 gets stick
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'First');
      
      // Agent2 and Agent3 queue up
      const req2 = await requestSpeakingStick(testAgents.agent2.structuredContent.id, 'Second');
      const req3 = await requestSpeakingStick(testAgents.agent3.structuredContent.id, 'Third');
      
      expect(req2.structuredContent.granted).toBe(false);
      expect(req3.structuredContent.granted).toBe(false);
      
      // Check queue order
      expect(req3.structuredContent.queue_position).toBe(2);
      expect(req3.structuredContent.simple_queue[0]).toBe(testAgents.agent2.structuredContent.id);
      expect(req3.structuredContent.simple_queue[1]).toBe(testAgents.agent3.structuredContent.id);
    });

    it('should handle urgent requests properly', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Setup queue
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'First');
      await requestSpeakingStick(testAgents.agent2.structuredContent.id, 'Second');
      
      // Urgent request jumps queue
      const urgent = await requestSpeakingStick(
        testAgents.agent3.structuredContent.id,
        'Urgent!',
        true
      );
      
      expect(urgent.structuredContent.simple_queue[0]).toBe(testAgents.agent3.structuredContent.id);
      expect(urgent.structuredContent.simple_queue[1]).toBe(testAgents.agent2.structuredContent.id);
    });
  });

  describe('Status and Information', () => {
    it('should provide complete status information', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'Topic');
      
      const status = await getSpeakingStickStatus();
      
      expect(status.structuredContent.mode).toBe('speaking-stick');
      expect(status.structuredContent.current_holder).toBe(testAgents.agent1.structuredContent.id);
      expect(status.structuredContent.stick_available).toBe(false);
    });

    it('should show stick as available when no holder', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      const status = await getSpeakingStickStatus();
      
      expect(status.structuredContent.current_holder).toBe(null);
      expect(status.structuredContent.stick_available).toBe(true);
    });
  });

  describe('Stick Transfer', () => {
    it('should transfer stick to next in queue', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Setup
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'First');
      await requestSpeakingStick(testAgents.agent2.structuredContent.id, 'Second');
      
      // Release
      const release = await releaseSpeakingStick(
        testAgents.agent1.structuredContent.id,
        'Done'
      );
      
      expect(release.structuredContent.released).toBe(true);
      expect(release.structuredContent.next_holder).toBe(testAgents.agent2.structuredContent.id);
      
      // Agent2 should now be able to broadcast
      const broadcast = await sendBroadcast(
        testAgents.agent2.structuredContent.id,
        'My turn now',
        'normal'
      );
      expect(broadcast.structuredContent.success).toBe(true);
    });

    it('should handle direct pass to specific agent', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Agent1 gets stick
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'First');
      
      // Direct pass to Agent3 (skipping any queue)
      const release = await releaseSpeakingStick(
        testAgents.agent1.structuredContent.id,
        'Passing to Agent3',
        testAgents.agent3.structuredContent.id
      );
      
      expect(release.structuredContent.next_holder).toBe(testAgents.agent3.structuredContent.id);
      
      // Agent3 can now broadcast
      const broadcast = await sendBroadcast(
        testAgents.agent3.structuredContent.id,
        'Thanks for the stick!',
        'normal'
      );
      expect(broadcast.structuredContent.success).toBe(true);
    });
  });

  describe('Violation Tracking', () => {
    it('should track broadcast violations', async () => {
      await setCommunicationMode('speaking-stick', 'test', 'prompt-modification');
      
      // Agent1 has stick
      await requestSpeakingStick(testAgents.agent1.structuredContent.id, 'Topic');
      
      // Agent2 tries to broadcast multiple times
      const violation1 = await sendBroadcast(
        testAgents.agent2.structuredContent.id,
        'Violation 1',
        'normal'
      );
      const violation2 = await sendBroadcast(
        testAgents.agent2.structuredContent.id,
        'Violation 2',
        'normal'
      );
      
      expect(violation1.structuredContent.success).toBe(false);
      expect(violation1.structuredContent.totalViolations).toBe(1);
      expect(violation2.structuredContent.success).toBe(false);
      expect(violation2.structuredContent.totalViolations).toBe(2);
    });
  });
});