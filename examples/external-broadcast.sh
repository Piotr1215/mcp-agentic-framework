#!/bin/bash
# External Broadcast Examples for MCP Agentic Framework

# Default API key (set MCP_EXTERNAL_API_KEY env var to change)
API_KEY="${MCP_EXTERNAL_API_KEY:-test-key-123}"
SERVER_URL="http://127.0.0.1:3113"

echo "🚀 MCP External Broadcast Examples"
echo "=================================="
echo "Using API Key: $API_KEY"
echo "Server URL: $SERVER_URL"
echo ""

# Example 1: Basic broadcast
echo "Example 1: Basic broadcast from external system"
echo "----------------------------------------------"
curl -X POST "$SERVER_URL/external/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "from": "external-monitor",
    "message": "External system alert: Database backup completed successfully",
    "priority": "normal"
  }' | jq .

echo -e "\n"

# Example 2: High priority alert
echo "Example 2: High priority incident alert"
echo "---------------------------------------"
curl -X POST "$SERVER_URL/external/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "from": "monitoring-system",
    "message": "🚨 ALERT: CPU usage exceeded 90% on production server",
    "priority": "high"
  }' | jq .

echo -e "\n"

# Example 3: Workflow trigger
echo "Example 3: Trigger incident response workflow"
echo "--------------------------------------------"
curl -X POST "$SERVER_URL/external/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "from": "alerting-service",
    "message": "Production incident detected: API response time > 5s. Please investigate immediately.",
    "priority": "high"
  }' | jq .

echo -e "\n"

# Example 4: System update notification
echo "Example 4: System update notification"
echo "------------------------------------"
curl -X POST "$SERVER_URL/external/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "from": "deployment-pipeline",
    "message": "System update scheduled for tonight at 10 PM UTC. All services will be restarted.",
    "priority": "normal"
  }' | jq .

echo -e "\n"

# Example 5: Invalid API key (should fail)
echo "Example 5: Testing authentication (should fail)"
echo "----------------------------------------------"
curl -X POST "$SERVER_URL/external/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong-key" \
  -d '{
    "from": "unauthorized-system",
    "message": "This should not be sent",
    "priority": "low"
  }' | jq .