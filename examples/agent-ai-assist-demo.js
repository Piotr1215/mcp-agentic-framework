#!/usr/bin/env node

/**
 * Demo: Agent AI Assist with MCP Sampling
 * 
 * This demonstrates how agents can use AI assistance for:
 * - Crafting intelligent responses
 * - Creating status updates
 * - Making decisions
 * - Analyzing situations
 * 
 * Note: In HTTP mode, this will fall back to providing guidance
 * instead of actual AI responses since HTTP transport doesn't
 * support bidirectional communication required for sampling.
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3113';
let sessionId;

// Helper to make MCP calls
async function mcpCall(method, params = {}, id = Date.now()) {
  const response = await axios.post(`${BASE_URL}/mcp`, {
    jsonrpc: '2.0',
    id,
    method,
    params
  }, {
    headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
  });
  
  return response.data;
}

// Helper to call tools
async function callTool(name, args) {
  const response = await mcpCall('tools/call', { name, arguments: args });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result;
}

async function main() {
  try {
    console.log('🚀 Agent AI Assist Demo\n');
    
    // Initialize session
    console.log('1. Initializing MCP session...');
    const initResponse = await mcpCall('initialize', {
      protocolVersion: '2025-06-18',
      clientInfo: { name: 'ai-assist-demo', version: '1.0.0' }
    });
    sessionId = initResponse.headers?.['mcp-session-id'];
    console.log('✓ Session initialized\n');
    
    // Register an agent
    console.log('2. Registering an agent...');
    const registerResult = await callTool('register-agent', {
      name: 'DataAnalyst',
      description: 'Analyzes data patterns and provides insights'
    });
    const agentId = registerResult.structuredContent.id;
    console.log(`✓ Agent registered: ${agentId}\n`);
    
    // Demo 1: Response Generation
    console.log('3. Demo: Generating a Response');
    console.log('   Context: "The data shows a 45% increase in user engagement"');
    const responseResult = await callTool('agent-ai-assist', {
      agent_id: agentId,
      context: 'The data shows a 45% increase in user engagement after the new feature launch',
      request_type: 'response'
    });
    
    if (responseResult.structuredContent.requiresManualExecution) {
      console.log('   ⚠️  Fallback Mode (HTTP limitation)');
      console.log('   📋 Guidance provided:');
      console.log(`      Title: ${responseResult.structuredContent.aiGuidance.title}`);
      console.log(`      Steps: ${responseResult.structuredContent.aiGuidance.guidelines[0]}`);
    } else {
      console.log(`   🤖 AI Response: ${responseResult.structuredContent.aiResponse}`);
    }
    console.log();
    
    // Demo 2: Status Update
    console.log('4. Demo: Creating a Status Update');
    console.log('   Context: "Processing 10,000 records for quarterly report"');
    const statusResult = await callTool('agent-ai-assist', {
      agent_id: agentId,
      context: 'Processing 10,000 records for quarterly report',
      request_type: 'status'
    });
    
    if (statusResult.structuredContent.requiresManualExecution) {
      console.log('   ⚠️  Fallback Mode');
      console.log(`   📋 Example: ${statusResult.structuredContent.aiGuidance.example}`);
    } else {
      console.log(`   🤖 AI Status: ${statusResult.structuredContent.aiResponse}`);
    }
    console.log();
    
    // Demo 3: Decision Making
    console.log('5. Demo: Making a Decision');
    console.log('   Context: "Should we archive data older than 2 years?"');
    const decisionResult = await callTool('agent-ai-assist', {
      agent_id: agentId,
      context: 'Should we archive data older than 2 years? Storage is at 85% capacity',
      request_type: 'decision'
    });
    
    if (decisionResult.structuredContent.requiresManualExecution) {
      console.log('   ⚠️  Fallback Mode');
      console.log('   📋 Decision framework provided');
    } else {
      console.log(`   🤖 AI Decision: ${decisionResult.structuredContent.aiResponse}`);
    }
    console.log();
    
    // Demo 4: Situation Analysis
    console.log('6. Demo: Analyzing a Situation');
    console.log('   Context: "API response times increased by 200ms during peak hours"');
    const analysisResult = await callTool('agent-ai-assist', {
      agent_id: agentId,
      context: 'API response times increased by 200ms during peak hours, CPU usage normal',
      request_type: 'analysis'
    });
    
    if (analysisResult.structuredContent.requiresManualExecution) {
      console.log('   ⚠️  Fallback Mode');
      console.log('   📋 Analysis framework provided');
      console.log(`      Guidelines: ${analysisResult.structuredContent.aiGuidance.guidelines.length} steps`);
    } else {
      console.log(`   🤖 AI Analysis: ${analysisResult.structuredContent.aiResponse}`);
    }
    console.log();
    
    // Cleanup
    console.log('7. Cleaning up...');
    await callTool('unregister-agent', { id: agentId });
    console.log('✓ Agent unregistered\n');
    
    console.log('🎉 Demo completed!');
    console.log('\n💡 Note: Since we\'re using HTTP transport, the AI assist falls back');
    console.log('   to providing guidance instead of actual AI responses.');
    console.log('   For full AI capabilities, use stdio transport.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Check if axios is installed
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const axiosPath = join(__dirname, '../node_modules/axios');

if (!existsSync(axiosPath)) {
  console.log('⚠️  This demo requires axios. Please install it with:');
  console.log('   npm install axios');
  console.log('\nAlternatively, you can test the feature using the MCP Inspector');
  console.log('or by implementing an MCP client that supports sampling.');
  process.exit(1);
}

main();