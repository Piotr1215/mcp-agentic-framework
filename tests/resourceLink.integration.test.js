import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAgent, discoverAgents, sendBroadcast, resetInstances } from '../src/tools.js';
import * as fs from 'fs/promises';

describe('Resource Link Integration', () => {
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

  it('should demonstrate complete resource_link functionality', async () => {
    // Register multiple agents
    const codeReviewer = await registerAgent('code-reviewer', 'Reviews code for quality and security');
    const testRunner = await registerAgent('test-runner', 'Runs automated tests');
    const orchestrator = await registerAgent('orchestrator', 'Coordinates agent activities');
    
    // 1. Test discover agents with resource links
    console.log('\n=== Discovering Agents with Resource Links ===');
    const discoverResult = await discoverAgents();
    
    console.log('Agents found:', discoverResult.structuredContent.agents.length);
    console.log('Resource links:', JSON.stringify(discoverResult._meta.resource_links, null, 2));
    
    expect(discoverResult._meta.resource_links).toHaveLength(3);
    expect(discoverResult._meta.resource_links[0]).toMatchObject({
      uri: expect.stringContaining('agent://'),
      title: expect.stringContaining('Profile'),
      description: expect.stringContaining('profile')
    });
    
    // 2. Test broadcast (workflows are now handled by hooks, not resource links)
    console.log('\n=== Broadcasting Messages ===');
    const orchestratorId = orchestrator.structuredContent.id;
    const broadcastResult = await sendBroadcast(
      orchestratorId,
      'Attention all agents: System update scheduled. Please follow the system update workflow.',
      'high'
    );
    
    console.log('Broadcast sent to:', broadcastResult.structuredContent.recipientCount, 'agents');
    console.log('Success:', broadcastResult.structuredContent.success);
    
    // Broadcasts no longer include workflow resource links
    // Workflows are now triggered by hooks configured in settings.json
    expect(broadcastResult.structuredContent.success).toBe(true);
    expect(broadcastResult.structuredContent.recipientCount).toBe(2);
    
    // 3. Test another broadcast
    const codeReviewerId = codeReviewer.structuredContent.id;
    const codeReviewBroadcast = await sendBroadcast(
      codeReviewerId,
      'New code review request available. Please check your queue.',
      'normal'
    );
    
    console.log('\n=== Code Review Broadcast ===');
    console.log('Success:', codeReviewBroadcast.structuredContent.success);
    console.log('Recipients:', codeReviewBroadcast.structuredContent.recipientCount);
    
    expect(codeReviewBroadcast.structuredContent.success).toBe(true);
    
    console.log('\n=== Resource Link Implementation Complete ===');
    console.log('✅ Agent profile links in discover-agents');
    console.log('✅ Broadcasts work without workflow resource links');
    console.log('✅ Workflows are now handled by hooks');
  });
});