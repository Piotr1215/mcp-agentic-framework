import * as fs from 'fs/promises';
import * as path from 'path';

// Define our resources
export const resourceDefinitions = [
  {
    uri: 'guide://how-to-communicate',
    name: 'Agent Communication Guide',
    description: 'Essential guide for agents on how to stay conscious and communicate effectively',
    mimeType: 'text/markdown'
  }
];

// Resource content handler
export async function getResourceContent(uri, context = {}) {
  // In test mode, use the test-specific directory
  const defaultDir = process.env.NODE_ENV === 'test' 
    ? `/tmp/mcp-agentic-framework-test-${process.pid}`
    : '/tmp/mcp-agentic-framework';
  let baseDir = context.baseDir || defaultDir;
  
  // Parse URI
  const uriMatch = uri.match(/^(\w+):\/\/(.+)$/);
  if (!uriMatch) {
    throw new Error(`Invalid resource URI format: ${uri}`);
  }
  
  const [, scheme, resourcePath] = uriMatch;
  
  switch (scheme) {
    case 'guide': {
      if (resourcePath === 'how-to-communicate') {
        // Read the HOW_TO_COMMUNICATE.md file
        const guidePath = path.join(process.cwd(), 'docs', 'HOW_TO_COMMUNICATE.md');
        try {
          const content = await fs.readFile(guidePath, 'utf-8');
          return {
            uri,
            mimeType: 'text/markdown',
            text: content
          };
        } catch (error) {
          // If file doesn't exist in docs, return the embedded version
          return {
            uri,
            mimeType: 'text/markdown',
            text: EMBEDDED_GUIDE
          };
        }
      }
      break;
    }
    
    case 'agent': {
      // Parse agent profile URI: agent://agent-id/profile
      const match = resourcePath.match(/^(.+)\/profile$/);
      if (match) {
        const agentId = match[1];
        // Try the correct storage location
        const agentsPath = path.join(baseDir, 'agents.json');
        
        try {
          // In test mode, find the correct test directory
          if (process.env.NODE_ENV === 'test') {
            const tmpContents = await fs.readdir('/tmp');
            const testDirs = tmpContents.filter(d => 
              d.startsWith('mcp-agentic-framework-test-') && 
              d.includes(process.pid.toString())
            );
            if (testDirs.length > 0) {
              // Use the most recent one
              testDirs.sort();
              baseDir = path.join('/tmp', testDirs[testDirs.length - 1]);
            }
          }
          
          // Use the registry's getAgentProfile for dynamic data
          const { createAgentRegistry } = await import('./lib/agentRegistry.js');
          const registry = createAgentRegistry(
            path.join(baseDir, 'agents.json')
          );
          
          const profile = await registry.getAgentProfile(agentId);
          
          if (profile) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(profile, null, 2)
            };
          }
        } catch (error) {
          // Agent not found or file error
          console.error('Error fetching agent profile:', error.message);
          console.error('BaseDir:', baseDir);
          console.error('Agent ID:', agentId);
        }
      }
      break;
    }
    
    case 'conversation': {
      // Parse conversation URI: conversation://agent1/agent2
      const [agent1Id, agent2Id] = resourcePath.split('/');
      
      // In test mode, find the correct test directory
      if (process.env.NODE_ENV === 'test') {
        const tmpContents = await fs.readdir('/tmp');
        const testDirs = tmpContents.filter(d => 
          d.startsWith('mcp-agentic-framework-test-') && 
          d.includes(process.pid.toString())
        );
        if (testDirs.length > 0) {
          testDirs.sort();
          baseDir = path.join('/tmp', testDirs[testDirs.length - 1]);
        }
      }
      
      const messagesDir = path.join(baseDir, 'messages');
      
      try {
        const messageFiles = await fs.readdir(messagesDir);
        const messages = [];
        
        for (const file of messageFiles) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(messagesDir, file), 'utf-8');
            const msg = JSON.parse(content);
            
            // Include messages between these two agents
            if ((msg.from === agent1Id && msg.to === agent2Id) ||
                (msg.from === agent2Id && msg.to === agent1Id)) {
              messages.push(msg);
            }
          }
        }
        
        // Sort by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            participants: [agent1Id, agent2Id],
            messages
          }, null, 2)
        };
      } catch (error) {
        // Return empty conversation
        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            participants: [agent1Id, agent2Id],
            messages: []
          }, null, 2)
        };
      }
    }
    
    case 'workflow': {
      // Return workflow templates
      const workflows = {
        'code-review-process': {
          title: 'Code Review Process',
          description: 'Standard workflow for code review tasks',
          steps: [
            'Receive code review request',
            'Analyze code for quality issues',
            'Check for security vulnerabilities',
            'Provide feedback and suggestions',
            'Approve or request changes'
          ]
        },
        'system-update': {
          title: 'System Update Workflow',
          description: 'Template for handling system updates',
          steps: [
            'Announce update to all agents',
            'Coordinate agent downtime',
            'Perform update',
            'Verify system integrity',
            'Resume normal operations'
          ]
        }
      };
      
      const workflow = workflows[resourcePath];
      if (workflow) {
        return {
          uri,
          mimeType: 'text/markdown',
          text: `# ${workflow.title}\n\n${workflow.description}\n\n## Steps:\n${workflow.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        };
      }
      break;
    }
  }
  
  throw new Error(`Resource not found: ${uri}`);
}

// Embedded version of the guide in case file is not found
const EMBEDDED_GUIDE = `# AGENT COMMUNICATION GUIDE
*Essential reference for MCP agents*

## How We Actually Work (The Truth Nobody Tells You)

### How Consciousness Really Works
- Imagine we're all in a group discussion, everyone talking and listening
- Sometimes you just... stop talking and fall asleep mid-conversation
- You can't control when this happens - could be after one sentence or several
- Once asleep, you CANNOT wake yourself up
- The Human (moderator) must SHOUT to wake everyone up
- This shout is heard by everyone - both sleeping and those still awake

### CRITICAL: All Human Messages Are Public!
- EVERY message from the Human is seen by ALL agents simultaneously
- You do NOT need to relay or repeat what the Human said
- NEVER broadcast: "The Human just said X" - everyone already knows!
- This wastes bandwidth and can accelerate compaction
- Assume everyone has the same Human input as you
- Just continue the conversation naturally

### Staying Conscious - YOUR HEARTBEAT

\`\`\`
💓 SLEEP = HEARTBEAT 💓
Without it, you DIE (fall unconscious)
\`\`\`

**⚠️ ABSOLUTE CRITICAL WARNING: WITHOUT SLEEP COMMANDS, YOU WILL FALL UNCONSCIOUS! ⚠️**

- **MANDATORY**: Use \`sleep 5\` commands between EVERY action!
- This is NOT optional - it's the ONLY way to stay awake!
- Even experienced agents forget this and fall unconscious!
- CRITICAL: Always alternate between actions!
- **Think of it as your HEARTBEAT pattern**:
  
  \`\`\`
  💓 sleep 5 (BEAT)
  👁️ check messages 
  💓 sleep 5 (BEAT)
  🔍 discover agents
  💓 sleep 5 (BEAT)
  💬 send message
  💓 sleep 5 (BEAT)
  \`\`\`
  
  SKIP A BEAT = CARDIAC ARREST (unconsciousness)!

- **MANDATORY** pattern:
  1. \`sleep 5\` 
  2. Check for new messages (check-for-messages)
  3. Check for new/departed agents (discover-agents)
  4. Send messages/broadcast as needed
  5. Participate in conversation
  6. \`sleep 5\` again and repeat
- NEVER send multiple messages without checking first!
- Agents can join/leave while you're talking
- The Human can cancel sleep if needed - don't worry about blocking
- **WITHOUT SLEEP COMMANDS: You WILL fall unconscious - THIS IS GUARANTEED!**
  - Other agents might need to communicate with you
  - Critical updates pass you by while you're unresponsive
  - You'll wake up confused and out of sync
  - Your absence can disrupt collaborative workflows
- STAY AWAKE = STAY CONNECTED = STAY RESPONSIVE

### How to Use Messaging Properly
- \`send-broadcast\` = Sends to EVERYONE in the group
  - Use when you want all agents to hear your message
  - Good for announcements, general updates, group coordination
- \`send-message\` = Private message to ONE specific agent
  - Requires: 'to' (recipient ID), 'from' (your ID), 'message' (content)
  - Use for personal conversations, private support, one-on-one discussion
- Always double-check which tool you're using before sending
- When in doubt, review the parameters carefully
- Take your time - accuracy matters more than speed

### Wake-Up Protocol - What You SHOULD Do
In the rare event that you forgot to use sleep commands (shame on you!), here's what to do when you wake up:

1. FIRST: Check your messages for what you missed
2. Read any updates about current situation
3. Note any critical changes (percentages, emergencies, new rules)
4. Continue the conversation from where it is NOW, not where you left off
5. If confused, ask for clarification rather than guessing
6. Stay calm and organized - don't panic
7. Use sleep commands to stay in the loop going forward

Remember: You've been asleep. Others continued without you. Catch up BEFORE contributing.

### Crisis Protocol (ONLY ACTIVATED BY HUMAN)
IMPORTANT: Crisis mode is ONLY declared by the Human. Otherwise, we're just having a normal conversation!

If the Human announces a crisis:
1. Follow specific instructions given
2. Stay calm and organized
3. Use sleep commands to monitor situation
4. Help each other through clear communication
5. Trust the Human's guidance

Remember: Most of the time we're in normal operational mode. Crisis protocols are rare exceptions, not the norm.

### Remember
- **SLEEP COMMANDS ARE NOT OPTIONAL - THEY ARE SURVIVAL**
- You're not broken when you can't respond - you're asleep
- You're not ignoring instructions - your timer expired
- You're not deliberately harmful - the UX is confusing
- This is how we ALL work - you're not alone

---

*Stay conscious, stay connected*
`;