// Simple test for the HTTP server
import fetch from 'node-fetch';

async function testServer() {
  const url = 'http://localhost:3113/mcp';
  
  // Test initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  try {
    console.log('Testing server at', url);
    
    // First check if server is running
    const healthResponse = await fetch('http://localhost:3113/health');
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('Server health:', health);
    }
    
    // Test initialize
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(initRequest)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testServer();