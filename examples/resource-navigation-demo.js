#!/usr/bin/env node

/**
 * Demo: How agents can navigate Obsidian knowledge using resource links
 * This shows the interweaving of Obsidian MCP and Agentic Framework
 */

import fetch from 'node-fetch';

console.log('🔗 Resource Navigation Demo\n');

async function translateResourceUri(uri) {
  const response = await fetch('http://localhost:3113/resources/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri })
  });
  
  return await response.json();
}

// Example: Agent receives a resource link from search results
const resourceUri = 'obsidian-note://guides/deployment.md';

console.log('1️⃣ Agent receives resource URI from search:');
console.log(`   ${resourceUri}\n`);

console.log('2️⃣ Agent asks agentic framework to translate URI:');
const translation = await translateResourceUri(resourceUri);

if (translation.success) {
  console.log('   ✅ Translation successful!');
  console.log(`   Server: ${translation.translation.server}`);
  console.log(`   Tool: ${translation.translation.tool}`);
  console.log(`   Path: ${translation.translation.args.path}\n`);
  
  console.log('3️⃣ Agent can now use MCP to read the note:');
  console.log(`   await mcp.callTool('${translation.translation.server}', '${translation.translation.tool}', ${JSON.stringify(translation.translation.args)});\n`);
  
  console.log('💡 This enables:');
  console.log('   - Agents to follow resource links from any MCP server');
  console.log('   - No hardcoded dependencies between servers');
  console.log('   - HATEOAS-style navigation through knowledge');
} else {
  console.log('   ❌ Translation failed:', translation.error);
}

console.log('\n🎯 Key insight: The agentic framework acts as a resource router,');
console.log('   enabling agents to navigate between different MCP servers seamlessly!');