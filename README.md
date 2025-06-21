# MCP Agentic Framework

A Model Context Protocol (MCP) based communication framework that enables multiple AI agents to collaborate through asynchronous messaging. Built with Test-Driven Development (TDD) and functional programming principles.

## Overview

This framework provides a standardized way for multiple Claude agents (or other MCP-compatible agents) to:
- Register themselves with unique identities
- Discover other registered agents
- Exchange messages asynchronously
- Send broadcasts to all agents
- Work together on complex tasks

The framework uses file-based storage for simplicity and portability, making it easy to run without external dependencies.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Developer Agent │     │  Tester Agent   │     │ Architect Agent │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                      ┌──────────┴──────────┐
                      │   MCP Server        │
                      │  ┌──────────────┐   │
                      │  │Agent Registry│   │
                      │  └──────────────┘   │
                      │  ┌──────────────┐   │
                      │  │ Message Store│   │
                      │  └──────────────┘   │
                      └─────────────────────┘
                                 │
                      ┌──────────┴──────────┐
                      │ File Storage        │
                      │/tmp/mcp-agentic-    │
                      │    framework/       │
                      └─────────────────────┘
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Piotr1215/mcp-agentic-framework.git
cd mcp-agentic-framework
```

2. Install dependencies:
```bash
npm install
```

3. Run tests to verify installation:
```bash
npm test
```

## Usage with Claude Desktop or Claude Code

### Using HTTP Transport


```json
{
  "mcpServers": {
    "agentic-framework": {
      "type": "http",
      "url": "http://127.0.0.1:3113/mcp"
    }
  }
}
```

To use the HTTP transport:
1. Start the HTTP server: `npm run start:http`
2. Add the above configuration to your `~/.claude.json`
3. Restart Claude Desktop

**Note**: The HTTP transport supports Server-Sent Events (SSE)

## Available Tools

### `register-agent`
Register a new agent in the system.

**Parameters:**
- `name` (string, required): Agent's display name
- `description` (string, required): Agent's role and capabilities
- `instanceId` (string, optional): Instance identifier for automatic deregistration

**Example:**
```javascript
{
  "name": "DeveloperAgent",
  "description": "Responsible for writing code and implementing features"
}
```

### `unregister-agent`
Remove an agent from the system.

**Parameters:**
- `id` (string, required): Agent's unique identifier

### `discover-agents`
List all currently registered agents.

**Parameters:** None

**Response Example:**
```javascript
[
  {
    "id": "agent_abc123",
    "name": "DeveloperAgent",
    "description": "Responsible for writing code",
    "status": "online",
    "lastActivityAt": "2024-01-20T10:30:00.000Z"
  }
]
```

### `send-message`
Send a message from one agent to another.

**Parameters:**
- `to` (string, required): Recipient agent's ID
- `from` (string, required): Sender agent's ID
- `message` (string, required): Message content

### `check-for-messages`
Retrieve unread messages for an agent. Messages are automatically deleted after reading.

**Parameters:**
- `agent_id` (string, required): Agent's ID to check messages for

**Response Example:**
```javascript
{
  "messages": [
    {
      "from": "agent_abc123",
      "fromName": "DeveloperAgent",
      "message": "Task completed",
      "timestamp": "2024-01-20T10:30:00.000Z"
    }
  ]
}
```

### `update-agent-status`
Update an agent's status (online, offline, busy, away).

**Parameters:**
- `agent_id` (string, required): Agent's ID
- `status` (string, required): New status (one of: online, offline, busy, away)

### `send-broadcast` 
Send a broadcast message to all registered agents (except the sender).

**Parameters:**
- `from` (string, required): Sender agent's ID
- `message` (string, required): Broadcast message content
- `priority` (string, optional): Priority level (low, normal, high). Defaults to 'normal'

**Features:**
- Messages are delivered to all agents except the sender
- Works without requiring agents to subscribe
- Returns the number of recipients
- Messages are prefixed with priority level (e.g., "[BROADCAST HIGH]")

**Example:**
```javascript
{
  "from": "orchestrator",
  "message": "System maintenance in 10 minutes",
  "priority": "high"
}
```

**Response:**
```javascript
{
  "success": true,
  "recipientCount": 5,
  "errors": []  // Any delivery failures
}
```

### `get-pending-notifications`
Retrieve pending notifications for an agent.

**Parameters:**
- `agent_id` (string, required): Agent's ID

## Example Workflows

### Multi-Agent Collaboration

```
1. Register agents:
   - "Register an orchestrator agent for coordinating tasks"
   - "Register worker1 agent for processing"
   - "Register worker2 agent for analysis"

2. Orchestrator delegates tasks:
   - "Send message from orchestrator to worker1: Process customer data"
   - "Send message from orchestrator to worker2: Analyze market trends"

3. Workers communicate:
   - "Send message from worker1 to worker2: Data ready for analysis"

4. Broadcast updates:
   - "Send broadcast from orchestrator: All tasks completed"
```

### Using Broadcasts

The improved broadcast feature allows efficient communication with all agents:

```javascript
// Orchestrator sends high-priority announcement
await sendBroadcast(
  orchestratorId,
  "Emergency: System overload detected, pause all operations",
  "high"
);

// All other agents receive: "[BROADCAST HIGH] Emergency: System overload..."

// Regular status update
await sendBroadcast(
  orchestratorId,
  "Daily standup meeting in 5 minutes",
  "normal"
);

// All agents receive: "[BROADCAST NORMAL] Daily standup meeting..."
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Storage

The framework stores data in `/tmp/mcp-agentic-framework/`:
- `agents.json`: Registered agents with status and activity tracking
- `messages/*.json`: Individual message files (one per message)

### Security Considerations

- Input validation on all tool parameters
- File-based locking prevents race conditions
- No path traversal vulnerabilities
- Messages are stored locally only
- No external network calls

## API Reference

### Agent Object
```typescript
interface Agent {
  id: string;             // Unique identifier
  name: string;           // Display name
  description: string;    // Role description
  status: string;         // online|offline|busy|away
  registeredAt: string;   // ISO timestamp
  lastActivityAt: string; // ISO timestamp
}
```

### Message Object
```typescript
interface Message {
  id: string;          // Message ID
  from: string;        // Sender agent ID
  to: string;          // Recipient agent ID
  message: string;     // Content
  timestamp: string;   // ISO timestamp
  read: boolean;       // Read status
}
```

## Practical Use Cases

### 1. Orchestrated Task Processing
```
Orchestrator → assigns tasks → Worker agents
Worker agents → process in parallel → report back
Orchestrator → broadcasts completion → all agents notified
```

### 2. Distributed Code Review
```
Developer → sends code → multiple Reviewers
Reviewers → work independently → send feedback
Developer → broadcasts updates → all reviewers see changes
```

### 3. Emergency Coordination
```
Monitor agent → detects issue → broadcasts alert
All agents → receive alert → adjust behavior
Coordinator → broadcasts all-clear → normal operations resume
```

## Troubleshooting

### Common Issues

1. **Broadcasts not received**
   - Ensure sender agent is registered
   - Check recipient agents are registered
   - Remember sender doesn't receive own broadcasts

2. **"Agent not found" errors**
   - Verify agent registration
   - Use `discover-agents` to list all agents
   - Check agent IDs are correct

3. **Messages not received**
   - Messages are deleted after reading
   - Each message can only be read once
   - Check correct agent ID

## License

MIT License
