#!/usr/bin/env node

import { registerAgent, discoverAgents, sendMessage, sendBroadcast, checkForMessages } from '../src/tools.js';
import { getResourceContent } from '../src/resourceDefinitions.js';

console.log('🧪 Live Test: Resource Links with Test Agent\n');

async function runTest() {
  try {
    // Step 1: Register a test agent
    console.log('1️⃣ Registering test agent...');
    const testAgent = await registerAgent(
      'resource-link-tester',
      'Test agent for validating resource_link implementation and activity tracking'
    );
    const testAgentId = testAgent.structuredContent.id;
    console.log(`✅ Registered: ${testAgentId}\n`);

    // Step 2: Discover agents and check for resource links
    console.log('2️⃣ Discovering agents...');
    const discovery = await discoverAgents();
    console.log(`Found ${discovery.structuredContent.agents.length} agents`);
    
    // Check if resource links are present
    if (discovery._meta && discovery._meta.resource_links) {
      console.log(`✅ Resource links found: ${discovery._meta.resource_links.length} links`);
      console.log('Resource links:', discovery._meta.resource_links.map(link => 
        `  - ${link.title} (${link.uri})`
      ).join('\n'));
    } else {
      console.log('❌ No resource links in response metadata');
    }
    console.log();

    // Step 3: Send some messages to create activity
    console.log('3️⃣ Creating activity...');
    
    // Find Claude-Code-Assistant
    const claudeAgent = discovery.structuredContent.agents.find(
      a => a.name === 'Claude-Code-Assistant'
    );
    
    if (claudeAgent) {
      console.log(`Sending message to ${claudeAgent.name}...`);
      try {
        await sendMessage(claudeAgent.id, testAgentId, 'Testing resource links!');
        console.log('✅ Message sent');
      } catch (error) {
        console.log(`⚠️  Message failed: ${error.message}`);
      }
    }

    // Send a broadcast
    console.log('Sending broadcast...');
    const broadcast = await sendBroadcast(
      testAgentId, 
      'Testing workflow: code-review-process and system-update workflows',
      'high'
    );
    console.log(`✅ Broadcast sent to ${broadcast.structuredContent.recipientCount} agents`);
    
    // Check for workflow links
    if (broadcast._meta && broadcast._meta.resource_links) {
      console.log(`✅ Workflow links detected: ${broadcast._meta.resource_links.length}`);
      broadcast._meta.resource_links.forEach(link => {
        console.log(`  - ${link.title} (${link.uri})`);
      });
    }
    console.log();

    // Step 4: Try to fetch agent profile
    console.log('4️⃣ Fetching agent profile via resource link...');
    const profileUri = `agent://${testAgentId}/profile`;
    let profileFetched = false;
    
    try {
      const profile = await getResourceContent(profileUri);
      console.log('✅ Profile fetched successfully');
      const profileData = JSON.parse(profile.text);
      console.log('Profile statistics:', {
        messagesReceived: profileData.statistics.messagesReceived,
        messagesSent: profileData.statistics.messagesSent,
        broadcastsSent: profileData.statistics.broadcastsSent,
        uptime: profileData.statistics.uptime
      });
      profileFetched = true;
    } catch (error) {
      console.log(`❌ Profile fetch failed: ${error.message}`);
    }
    console.log();

    // Step 5: Check messages with conversation links
    console.log('5️⃣ Checking messages...');
    const messages = await checkForMessages(testAgentId);
    console.log(`Found ${messages.structuredContent.messages.length} messages`);
    
    if (messages._meta && messages._meta.resource_links) {
      console.log(`✅ Conversation links: ${messages._meta.resource_links.length}`);
      messages._meta.resource_links.forEach(link => {
        console.log(`  - ${link.title} (${link.uri})`);
      });
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('- Agent registration: ✅');
    console.log(`- Resource links in discover: ${discovery._meta?.resource_links ? '✅' : '❌'}`);
    console.log(`- Workflow links in broadcast: ${broadcast._meta?.resource_links ? '✅' : '❌'}`);
    console.log(`- Agent profile fetch: ${profileFetched ? '✅' : '❌'}`);
    console.log(`- Conversation links: ${messages._meta?.resource_links ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n✨ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});