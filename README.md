# MCP Agentic Framework

A Model Context Protocol (MCP) based communication framework that enables multiple AI agents to collaborate through asynchronous messaging. Built with Test-Driven Development (TDD) and functional programming principles.

## Overview

This framework provides a standardized way for multiple Claude agents (or other MCP-compatible agents) to:
- Register themselves with unique identities
- Discover other registered agents
- Exchange messages asynchronously
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
git clone <repository-url>
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

## Usage with Claude Desktop

### 1. Configure Claude Desktop

Add the MCP agentic framework to your Claude Desktop configuration file (`~/.claude.json`):

```json
{
  "mcpServers": {
    "agentic-framework": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/mcp-agentic-framework/src/index.js"
      ],
      "env": {}
    }
  }
}
```

Replace `/path/to/mcp-agentic-framework` with the actual path to your installation.

### 2. Understanding the Push Notification System

**✅ Push Notifications Implemented**: The notification system now supports **true push notifications** using MCP's built-in notification capability. Here's how it works:

1. **Events trigger immediate push**: When agents register, send messages, or broadcast, notifications are **immediately pushed** to all connected Claude instances
2. **Real-time delivery**: Notifications are sent using MCP's JSON-RPC notification protocol (messages without request IDs)
3. **Automatic reception**: Claude instances receive notifications in real-time without polling

**Example workflow**:
```
Agent A: Registers as a new agent
→ Push notification immediately sent to all connected Claude instances
→ Other Claude instances receive: {"method": "agent/registered", "params": {...}}
```

**How it Works**:
- When events occur (agent registration, messages, broadcasts), the server calls `server.notification()`
- MCP sends these as JSON-RPC notifications (no request ID)
- Connected clients (Claude instances) receive them in real-time
- No polling required - notifications arrive immediately

**Push Notification Types**:
- `agent/registered` - New agent joins
- `agent/unregistered` - Agent leaves  
- `agent/statusChanged` - Agent status updates
- `message/delivered` - Messages sent between agents
- `broadcast/message` - System-wide broadcasts

**Real-time Multi-Agent Collaboration**: Each Claude instance can now react immediately when:
- New agents join the system
- Messages are sent between agents
- Broadcasts are made
- Agent statuses change

### 3. Restart Claude Desktop

After adding the configuration, restart Claude Desktop:
- Close Claude Desktop completely
- Reopen Claude Desktop
- The agentic framework tools should now be available

### 4. Available Tools

The framework exposes the following MCP tools:

#### `register-agent`
Register a new agent in the system.

**Parameters:**
- `name` (string, required): Agent's display name
- `description` (string, required): Agent's role and capabilities

**Example:**
```javascript
{
  "name": "DeveloperAgent",
  "description": "Responsible for writing code and implementing features"
}
```

**Response:**
```javascript
{
  "id": "agent_abc123",
  "name": "DeveloperAgent",
  "description": "Responsible for writing code and implementing features"
}
```

#### `unregister-agent`
Remove an agent from the system.

**Parameters:**
- `id` (string, required): Agent's unique identifier

**Example:**
```javascript
{
  "id": "agent_abc123"
}
```

#### `discover-agents`
List all currently registered agents.

**Parameters:** None

**Response:**
```javascript
[
  {
    "id": "agent_abc123",
    "name": "DeveloperAgent",
    "description": "Responsible for writing code"
  },
  {
    "id": "agent_def456",
    "name": "TesterAgent",
    "description": "Responsible for testing"
  }
]
```

#### `send-message`
Send a message from one agent to another.

**Parameters:**
- `to` (string, required): Recipient agent's ID
- `from` (string, required): Sender agent's ID
- `message` (string, required): Message content

**Example:**
```javascript
{
  "to": "agent_def456",
  "from": "agent_abc123",
  "message": "Please test the authentication module"
}
```

#### `check-for-messages`
Retrieve unread messages for an agent. Messages are automatically marked as read.

**Parameters:**
- `agentId` (string, required): Agent's ID to check messages for

**Response:**
```javascript
[
  {
    "from": "agent_abc123",
    "message": "Please test the authentication module",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
]
```

#### `update-agent-status`
Update an agent's status (online, offline, busy, away).

**Parameters:**
- `agent_id` (string, required): Agent's ID
- `status` (string, required): New status (one of: online, offline, busy, away)

**Example:**
```javascript
{
  "agent_id": "agent_abc123",
  "status": "busy"
}
```

#### `subscribe-to-notifications`
Subscribe an agent to receive notifications for specific events.

**Parameters:**
- `agent_id` (string, required): Agent's ID
- `events` (array, required): Array of event patterns to subscribe to

**Event Patterns:**
- `agent/*` - All agent-related events
- `agent/registered` - New agent registrations
- `agent/unregistered` - Agent unregistrations
- `agent/statusChanged` - Agent status changes
- `message/*` - All message-related events
- `message/delivered` - Message deliveries
- `message/acknowledged` - Message acknowledgments
- `broadcast/*` - All broadcast events
- `queue/*` - Queue status updates

**Example:**
```javascript
{
  "agent_id": "agent_abc123",
  "events": ["agent/*", "broadcast/*"]
}
```

#### `unsubscribe-from-notifications`
Unsubscribe an agent from notifications.

**Parameters:**
- `agent_id` (string, required): Agent's ID
- `events` (array, optional): Specific events to unsubscribe from. If not provided, unsubscribes from all.

**Example:**
```javascript
{
  "agent_id": "agent_abc123",
  "events": ["agent/*"]
}
```

#### `send-broadcast`
Send a broadcast message to all agents.

**Parameters:**
- `from` (string, required): Sender agent's ID
- `message` (string, required): Broadcast message content
- `priority` (string, optional): Priority level (low, normal, high). Defaults to 'normal'

**Example:**
```javascript
{
  "from": "agent_system",
  "message": "Server maintenance scheduled for 10 PM",
  "priority": "high"
}
```

#### `get-pending-notifications`
Retrieve pending notifications for an agent. Notifications are cleared after retrieval.

**Parameters:**
- `agent_id` (string, required): Agent's ID

**Response:**
```javascript
[
  {
    "jsonrpc": "2.0",
    "method": "agent/registered",
    "params": {
      "agentId": "agent_xyz789",
      "name": "NewAgent",
      "description": "A newly registered agent",
      "timestamp": "2024-01-20T10:35:00.000Z"
    }
  }
]
```

## Example Workflows

### Using with Claude Desktop

Once the server is configured and Claude Desktop is restarted, you can use natural language to interact with the framework:

```
"Register a developer agent responsible for writing code"
"Register a tester agent responsible for testing"
"Send a message from developer to tester asking them to test the auth module"
"Check messages for the tester agent"
```

### Notification Example

Here's how agents can react to events using the notification system:

```
"Register an observer agent that monitors system activity"
"Subscribe the observer to all agent events"
"Register a new developer agent"
"Check pending notifications for the observer"
```

The observer will receive a notification that a new agent was registered!

### Programmatic Example

Here's a typical multi-agent collaboration scenario:

```javascript
// 1. Register agents
const developer = await registerAgent("DeveloperAgent", "Writes code");
const tester = await registerAgent("TesterAgent", "Tests code");
const architect = await registerAgent("ArchitectAgent", "Designs systems");

// 2. Architect assigns task to developer
await sendMessage(
  developer.id,
  architect.id,
  "Please implement user authentication with JWT"
);

// 3. Developer checks messages
const devMessages = await checkForMessages(developer.id);
// Receives: "Please implement user authentication with JWT"

// 4. Developer completes task and notifies tester
await sendMessage(
  tester.id,
  developer.id,
  "Authentication module ready at /api/auth"
);

// 5. Tester finds issue and reports back
await sendMessage(
  developer.id,
  tester.id,
  "Found bug: JWT expiry not handled correctly"
);

// 6. Developer fixes and confirms
await sendMessage(
  architect.id,
  developer.id,
  "Bug fixed, authentication module complete"
);
```

### Notification-Based Collaboration

Here's how agents can react to events in real-time:

```javascript
// 1. Create a monitoring agent that watches for new agents
const monitor = await registerAgent("MonitorAgent", "Monitors system activity");
await subscribeToNotifications(monitor.id, ["agent/*", "broadcast/*"]);

// 2. Create a team lead agent
const teamLead = await registerAgent("TeamLeadAgent", "Manages the team");

// 3. Monitor gets notified about the new team lead
const notifications = await getPendingNotifications(monitor.id);
// Receives: agent/registered notification for TeamLeadAgent

// 4. Team lead sends a broadcast
await sendBroadcast(
  teamLead.id,
  "Team meeting at 3 PM to discuss new features",
  "high"
);

// 5. Monitor receives the broadcast
const moreNotifications = await getPendingNotifications(monitor.id);
// Receives: broadcast/message notification

// 6. Multiple agents can subscribe to specific events
const qaAgent = await registerAgent("QAAgent", "Quality assurance");
await subscribeToNotifications(qaAgent.id, ["message/delivered"]);

// Now QA gets notified whenever messages are sent
await sendMessage(developer.id, qaAgent.id, "New build ready for testing");
const qaNotifications = await getPendingNotifications(qaAgent.id);
// Receives: message/delivered notification
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

### Project Structure

```
mcp-agentic-framework/
├── src/
│   ├── lib/
│   │   ├── agentRegistry.js        # Agent registration logic
│   │   ├── messageStore.js         # Message storage logic
│   │   ├── notificationManager.js  # Event-based notifications
│   │   └── fileLock.js            # File locking for concurrency
│   ├── tools.js                    # Tool implementations
│   ├── toolDefinitions.js          # MCP tool schemas
│   ├── server.js                   # MCP server setup
│   ├── errors.js                   # Error handling
│   ├── response-formatter.js       # Response formatting
│   ├── index.js                    # Entry point (stdio)
│   ├── http-server.js              # HTTP server variant
│   ├── http-server-direct.js       # Direct HTTP server
│   └── http-server-simple.js       # Simple HTTP server
├── tests/
│   ├── agentRegistry.test.js       # Registry unit tests
│   ├── messageStore.test.js        # Store unit tests
│   ├── notificationManager.test.js # Notification tests
│   ├── notificationTools.test.js   # Notification integration tests
│   ├── tools.test.js               # Tool integration tests
│   ├── server.test.js              # Server tests
│   └── e2e.test.js                # End-to-end tests
└── package.json
```

### Alternative Server Modes

The framework includes several server implementations:

1. **stdio mode** (`npm start`) - Standard MCP server for Claude Desktop
2. **HTTP Direct** (`npm run start:http`) - Simple HTTP API at port 3113
3. **HTTP Simple** (`npm run start:http:simple`) - Basic HTTP server
4. **HTTP Advanced** (`npm run start:http:advanced`) - With SSE support (experimental)

These HTTP servers are useful for:
- Testing and debugging
- Integration with non-MCP clients
- Building custom notification systems

### Storage

The framework stores data in `/tmp/mcp-agentic-framework/`:
- `agents.json`: Registered agents  
- `messages/*.json`: Individual message files
- Notification state is maintained in memory

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
  id: string;           // Unique identifier
  name: string;         // Display name
  description: string;  // Role description
  registeredAt: string; // ISO timestamp
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

### Error Codes

The framework follows MCP error code standards:
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32001`: Resource not found
- `-32002`: Resource already exists

## Contributing

1. Follow TDD approach - write tests first
2. Maintain functional programming principles
3. Ensure all tests pass before submitting
4. Follow existing code style
5. Update documentation as needed

## Practical Use Cases

### 1. Multi-Agent Code Review
```
Developer Agent → writes code → notifies Reviewer Agent
Reviewer Agent → reviews code → sends feedback to Developer
Developer Agent → addresses feedback → notifies Tester Agent
Tester Agent → runs tests → reports results to all agents
```

### 2. Distributed Task Management
```
Manager Agent → breaks down project → assigns tasks to specialists
Frontend Agent → implements UI → reports progress
Backend Agent → builds API → coordinates with Frontend
QA Agent → tests integration → reports issues to relevant agents
```

### 3. Knowledge Sharing Network
```
Research Agent → finds information → shares with team
Analysis Agent → processes data → sends insights
Writer Agent → creates documentation → requests review
Editor Agent → reviews content → suggests improvements
```

## Tips for Effective Usage

1. **Agent Naming**: Use descriptive names that clearly indicate the agent's role
2. **Message Format**: Structure messages with clear action items and context
3. **Regular Polling**: Agents should check for messages periodically
4. **Message Acknowledgment**: Consider sending confirmations when tasks are received
5. **Error Handling**: Always check if agents exist before sending messages

## Troubleshooting

### Common Issues

1. **"Agent not found" errors**
   - Ensure the agent is registered before sending messages
   - Use `discover-agents` to verify registered agents
   - Check that you're using the correct agent ID

2. **Messages not received**
   - Remember that `check-for-messages` marks messages as read
   - Messages can only be retrieved once
   - Check the correct agent ID

3. **Server not available in Claude Desktop**
   - Ensure the path in `.claude.json` is absolute and correct
   - Restart Claude Desktop after configuration changes
   - Check that `src/index.js` exists and is executable

## License

MIT License

## Support

For issues and questions:
- Create an issue in the repository
- Check existing tests for usage examples
- Review the MCP specification at https://modelcontextprotocol.com
