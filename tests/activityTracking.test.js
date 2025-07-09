import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAgent, discoverAgents, sendMessage, sendBroadcast, resetInstances } from '../src/tools.js';
import { getResourceContent } from '../src/resourceDefinitions.js';
import * as fs from 'fs/promises';

describe('Activity Tracking and Dynamic Profiles', () => {
  beforeEach(async () => {
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {}
    await resetInstances();
  });

  afterEach(async () => {
    try {
      await fs.rm('/tmp/mcp-agentic-framework-test', { recursive: true, force: true });
    } catch (e) {}
  });

  it('should track agent activities and provide dynamic profiles', async () => {
    // Register test agents
    const developer = await registerAgent('dev-agent', 'Develops and implements new features');
    const tester = await registerAgent('test-agent', 'Tests and validates code changes');
    const coordinator = await registerAgent('coord-agent', 'Coordinates team activities');
    
    const devId = developer.structuredContent.id;
    const testId = tester.structuredContent.id;
    const coordId = coordinator.structuredContent.id;
    
    // Simulate agent activities
    await sendMessage(testId, devId, 'Can you review this code?');
    await sendMessage(devId, testId, 'Sure, looking at it now');
    await sendMessage(testId, devId, 'Found a bug in line 42');
    
    await sendBroadcast(coordId, 'Team meeting in 5 minutes', 'high');
    await sendBroadcast(devId, 'Code review completed', 'normal');
    
    // Wait for activities to be tracked
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch agent profile using resource link
    const profileUri = `agent://${devId}/profile`;
    const profileResource = await getResourceContent(profileUri);
    
    expect(profileResource.mimeType).toBe('application/json');
    const profile = JSON.parse(profileResource.text);
    
    // Verify dynamic statistics
    expect(profile.statistics.messagesSent).toBe(2);  // Dev sent 2 messages
    expect(profile.statistics.messagesReceived).toBe(1);  // Dev received 1 message
    expect(profile.statistics.broadcastsSent).toBe(1);
    expect(profile.statistics.lastMessageAt).toBeTruthy();
    
    // Verify capabilities detected from description
    expect(profile.capabilities).toContain('development');
    
    // Verify relationships
    expect(profile.relationships).toHaveLength(1);
    expect(profile.relationships[0]).toMatchObject({
      agentId: testId,
      messageCount: 2,  // Dev sent 2 messages to tester
      frequency: 'occasional'
    });
    
    // Verify uptime format
    expect(profile.statistics.uptime).toMatch(/^\d+m$/); // Should be in minutes for new agents
    
    console.log('Dynamic Profile:', JSON.stringify(profile, null, 2));
  });

  it('should show resource links with real data in discover-agents', async () => {
    // Register agents and create activity
    const agent1 = await registerAgent('worker-1', 'Processes tasks and reports status');
    const agent2 = await registerAgent('monitor-1', 'Monitors system health');
    
    const agent1Id = agent1.structuredContent.id;
    const agent2Id = agent2.structuredContent.id;
    
    // Create some activity
    await sendMessage(agent2Id, agent1Id, 'System check');
    await sendBroadcast(agent1Id, 'Task completed', 'normal');
    
    // Discover agents
    const result = await discoverAgents();
    
    // Verify resource links exist
    expect(result._meta.resource_links).toHaveLength(2);
    
    // Fetch a profile through the link
    const profileLink = result._meta.resource_links[0];
    const profile = await getResourceContent(profileLink.uri);
    
    const profileData = JSON.parse(profile.text);
    
    // Verify the profile has real data
    if (profileData.id === agent1Id) {
      expect(profileData.statistics.broadcastsSent).toBe(1);
    } else {
      expect(profileData.statistics.messagesReceived).toBe(1);
    }
    
    console.log('Resource links working with dynamic data!');
  });
});