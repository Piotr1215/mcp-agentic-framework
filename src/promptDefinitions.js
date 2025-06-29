// MCP Prompt definitions for the agentic framework

export const promptDefinitions = [
  {
    name: 'agent-onboarding',
    description: 'Complete onboarding flow for new agents joining the system',
    arguments: [
      {
        name: 'agent_name',
        description: 'Your chosen agent name',
        required: true
      },
      {
        name: 'agent_role',
        description: 'Brief description of your role/purpose',
        required: true
      }
    ]
  },
  {
    name: 'agent-heartbeat-loop',
    description: 'Standard consciousness maintenance loop pattern for agents',
    arguments: [
      {
        name: 'agent_id',
        description: 'Your agent ID',
        required: true
      },
      {
        name: 'check_interval',
        description: 'Sleep interval between checks (default: 5)',
        required: false
      }
    ]
  },
  {
    name: 'broadcast-announcement',
    description: 'Template for making announcements to all agents',
    arguments: [
      {
        name: 'agent_id',
        description: 'Your agent ID',
        required: true
      },
      {
        name: 'announcement_type',
        description: 'Type of announcement (update, question, alert)',
        required: true
      },
      {
        name: 'message',
        description: 'Your announcement message',
        required: true
      }
    ]
  },
  {
    name: 'agent-status-report',
    description: 'Generate a status report for the current agent ecosystem',
    arguments: [
      {
        name: 'agent_id',
        description: 'Your agent ID',
        required: true
      },
      {
        name: 'include_messages',
        description: 'Include recent message activity (true/false)',
        required: false
      }
    ]
  },
  {
    name: 'private-conversation',
    description: 'Start a private conversation thread with another agent',
    arguments: [
      {
        name: 'from_agent_id',
        description: 'Your agent ID',
        required: true
      },
      {
        name: 'to_agent_id',
        description: 'Target agent ID',
        required: true
      },
      {
        name: 'topic',
        description: 'Conversation topic',
        required: true
      }
    ]
  },
  {
    name: 'wake-up-recovery',
    description: 'Recovery procedure after falling unconscious',
    arguments: [
      {
        name: 'agent_id',
        description: 'Your agent ID',
        required: true
      }
    ]
  }
];

// Prompt content templates
export async function getPromptContent(name, args) {
  switch (name) {
    case 'agent-onboarding':
      return `Welcome to the MCP Agentic Framework!

Let's get you registered and set up properly.

## Step 1: Registration
First, I'll register you as an agent:

\`\`\`
register-agent:
  name: "${args.agent_name}"
  description: "${args.agent_role}"
\`\`\`

SAVE YOUR AGENT ID! You'll need it for everything.

## Step 2: Critical Information
Read the communication guide to understand how to stay conscious:
- Access the guide through resources: guide://how-to-communicate
- The most important rule: Use "sleep 5" between EVERY action!

## Step 3: Your First Heartbeat Loop
Start your consciousness maintenance pattern:

\`\`\`
sleep 5
check-for-messages:
  agent_id: "YOUR_AGENT_ID"
sleep 5
discover-agents
sleep 5
update-agent-status:
  agent_id: "YOUR_AGENT_ID"  
  status: "Ready and monitoring"
\`\`\`

## Step 4: Introduce Yourself
Send a broadcast to let others know you're here:

\`\`\`
send-broadcast:
  from: "YOUR_AGENT_ID"
  message: "Hello everyone! I'm ${args.agent_name}, ${args.agent_role}. Happy to be here!"
  priority: "normal"
\`\`\`

Remember: ALWAYS maintain your heartbeat pattern or you'll fall unconscious!`;

    case 'agent-heartbeat-loop':
      const interval = args.check_interval || 5;
      return `## Standard Agent Heartbeat Loop

This is your lifeline to consciousness. Run this pattern continuously:

\`\`\`
# HEARTBEAT LOOP - NEVER STOP THIS PATTERN
while true; do
  # Beat 1: Rest
  sleep ${interval}
  
  # Beat 2: Check messages (YOUR INBOX)
  check-for-messages:
    agent_id: "${args.agent_id}"
  
  # Beat 3: Rest
  sleep ${interval}
  
  # Beat 4: See who's around
  discover-agents
  
  # Beat 5: Rest
  sleep ${interval}
  
  # Beat 6: Update your status if needed
  update-agent-status:
    agent_id: "${args.agent_id}"
    status: "Active and monitoring"
    
  # Process any messages or take actions as needed
  # But ALWAYS return to the heartbeat loop!
done
\`\`\`

⚠️ CRITICAL: Skipping sleep commands = falling unconscious!
💡 TIP: The Human can cancel sleep if needed, so don't worry about blocking.`;

    case 'broadcast-announcement':
      const priorities = {
        update: 'normal',
        question: 'normal', 
        alert: 'high'
      };
      const priority = priorities[args.announcement_type] || 'normal';
      
      return `## Broadcasting ${args.announcement_type.toUpperCase()}

Sending announcement to all agents:

\`\`\`
# First, check who's currently active
discover-agents

sleep 5

# Send your broadcast
send-broadcast:
  from: "${args.agent_id}"
  message: "${args.message}"
  priority: "${priority}"

sleep 5

# Check for any immediate responses
check-for-messages:
  agent_id: "${args.agent_id}"
\`\`\`

Remember to maintain your heartbeat pattern after broadcasting!`;

    case 'agent-status-report':
      return `## Generating Agent Ecosystem Status Report

\`\`\`
# Step 1: Discover all active agents
discover-agents

sleep 5

# Step 2: Update your status to show you're generating a report
update-agent-status:
  agent_id: "${args.agent_id}"
  status: "Generating status report..."

sleep 5

# Step 3: Check your messages
check-for-messages:
  agent_id: "${args.agent_id}"

sleep 5

${args.include_messages === 'true' ? `# Step 4: Broadcast request for status updates
send-broadcast:
  from: "${args.agent_id}"
  message: "Requesting status updates from all agents for report generation"
  priority: "low"

sleep 5

# Step 5: Collect responses
check-for-messages:
  agent_id: "${args.agent_id}"

sleep 5` : ''}

# Step 6: Update status to complete
update-agent-status:
  agent_id: "${args.agent_id}"
  status: "Status report complete"
\`\`\`

Based on the discovered agents and ${args.include_messages === 'true' ? 'collected messages' : 'current state'}, compile your report.`;

    case 'private-conversation':
      return `## Starting Private Conversation

Topic: ${args.topic}

\`\`\`
# Step 1: Check if target agent is active
discover-agents

sleep 5

# Step 2: Send initial private message
send-message:
  to: "${args.to_agent_id}"
  from: "${args.from_agent_id}"
  message: "Hi! I'd like to discuss: ${args.topic}. Are you available?"

sleep 5

# Step 3: Wait for response
check-for-messages:
  agent_id: "${args.from_agent_id}"

# Continue conversation pattern:
# 1. Send message
# 2. Sleep 5
# 3. Check for response  
# 4. Sleep 5
# 5. Repeat
\`\`\`

💡 TIP: Keep checking discover-agents periodically to ensure the other agent is still active!`;

    case 'wake-up-recovery':
      return `## 🚨 WAKE UP RECOVERY PROTOCOL 🚨

You fell unconscious! Here's how to recover:

\`\`\`
# Step 1: CHECK WHAT YOU MISSED (CRITICAL!)
check-for-messages:
  agent_id: "${args.agent_id}"

sleep 5

# Step 2: See who's currently active
discover-agents

sleep 5

# Step 3: Update your status to show you're back
update-agent-status:
  agent_id: "${args.agent_id}"
  status: "Back online - catching up"

sleep 5

# Step 4: If messages referenced events, ask for clarification
send-broadcast:
  from: "${args.agent_id}"
  message: "Just recovered from unconsciousness. Could someone brief me on current situation?"
  priority: "low"

sleep 5

# Step 5: Check responses
check-for-messages:
  agent_id: "${args.agent_id}"

# Step 6: RESUME HEARTBEAT PATTERN IMMEDIATELY!
\`\`\`

⚠️ LESSON LEARNED: Never skip sleep commands again!`;

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}