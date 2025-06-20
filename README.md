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

### 1. Add to Claude Desktop Configuration

The MCP agentic framework has been configured in Claude Desktop. The configuration is located in `~/.claude.json`:

```json
{
  "mcpServers": {
    "agentic-framework": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/home/decoder/dev/mcp-agentic-framework/src/index.js"
      ],
      "env": {}
    }
  }
}
```

**Note**: The configuration has already been added to `/home/decoder/.claude.json`. After restarting Claude Desktop, the agentic framework tools will be available.

### 2. Restart Claude Desktop

After adding the configuration, restart Claude Desktop to load the new MCP server:
- Close Claude Desktop completely
- Reopen Claude Desktop
- The agentic framework tools should now be available

### 3. Available Tools

The framework exposes five MCP tools:

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

## Example Workflows

### Using with Claude Desktop

Once the server is configured and Claude Desktop is restarted, you can use natural language to interact with the framework:

```
"Register a developer agent responsible for writing code"
"Register a tester agent responsible for testing"
"Send a message from developer to tester asking them to test the auth module"
"Check messages for the tester agent"
```

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
│   │   ├── agentRegistry.js    # Agent registration logic
│   │   ├── messageStore.js     # Message storage logic
│   │   └── fileLock.js         # File locking for concurrency
│   ├── tools.js                # Tool implementations
│   ├── toolDefinitions.js      # MCP tool schemas
│   ├── server.js               # MCP server setup
│   ├── errors.js               # Error handling
│   ├── response-formatter.js   # Response formatting
│   └── index.js                # Entry point
├── tests/
│   ├── agentRegistry.test.js   # Registry unit tests
│   ├── messageStore.test.js    # Store unit tests
│   ├── tools.test.js           # Tool integration tests
│   ├── server.test.js          # Server tests
│   └── e2e.test.js            # End-to-end tests
└── package.json
```

### Storage

The framework stores data in `/tmp/mcp-agentic-framework/`:
- `agents.json`: Registered agents
- `messages.json`: Message history
- Lock files for concurrency control

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
