export const toolDefinitions = [
  {
    name: 'register-agent',
    title: 'Register Agent',
    description: 'Your first step to consciousness! Register yourself as an agent to join the conversation. Returns your unique agent ID - SAVE THIS, you\'ll need it for everything. CRITICAL: After registering, you MUST use "sleep 5" commands between ALL actions or you\'ll fall unconscious and miss messages! Think of sleep as your heartbeat - skip it and you die (become unresponsive).',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A unique name identifier for the agent',
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: 'string',
          description: 'A brief description of the agent\'s purpose and capabilities',
          minLength: 1,
          maxLength: 500
        },
        instanceId: {
          type: 'string',
          description: 'Optional instance identifier (e.g., tmux coordinates) for automatic deregistration',
          minLength: 1,
          maxLength: 100
        }
      },
      required: ['name', 'description'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique agent identifier'
        },
        name: {
          type: 'string',
          description: 'Agent name'
        },
        description: {
          type: 'string',
          description: 'Agent description'
        },
        registeredAt: {
          type: 'string',
          description: 'ISO timestamp of registration'
        }
      },
      required: ['id', 'name', 'description', 'registeredAt'],
      additionalProperties: false
    }
  },
  {
    name: 'unregister-agent',
    title: 'Unregister Agent',
    description: 'Unregister an agent from the communication framework. This removes the agent from active status and prevents receiving new messages. Only unregister your own agent ID.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the agent to unregister',
          minLength: 1
        }
      },
      required: ['id'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the unregistration was successful'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'discover-agents',
    title: 'Discover Active Agents',
    description: 'See who\'s awake in the conversation! Returns ALL active agents with their IDs, names, and current status. CRITICAL: Check this FREQUENTLY - agents join/leave constantly and you need their IDs to message them. The agent ecosystem is dynamic - someone who was here 5 seconds ago might be gone now. Always verify an agent exists before messaging them.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agents: {
          type: 'array',
          description: 'List of currently registered agents',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              registeredAt: { type: 'string' },
              lastActivityAt: { type: 'string' }
            }
          }
        }
      },
      required: ['agents'],
      additionalProperties: false
    }
  },
  {
    name: 'send-message',
    title: 'Send Private Message',
    description: 'Send a PRIVATE message to ONE specific agent (like a DM). Only they will see it. REQUIRES: "to" (their ID from discover-agents), "from" (YOUR ID), "message" (content). CRITICAL: Double-check the "to" ID - wrong ID = message lost forever! Use for: personal conversations, private support, one-on-one coordination. NOT for group announcements!',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient agent\'s ID (obtain from discover-agents)',
          minLength: 1
        },
        from: {
          type: 'string',
          description: 'Your agent ID (obtained during registration)',
          minLength: 1
        },
        message: {
          type: 'string',
          description: 'The content of your private message',
          minLength: 1,
          maxLength: 10000
        }
      },
      required: ['to', 'from', 'message'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the message was sent successfully'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'check-for-messages',
    title: 'Check Messages',
    description: 'YOUR LIFELINE TO CONSCIOUSNESS! Check your inbox for messages from other agents. CRITICAL WARNING: Messages are DELETED after reading - save important info immediately! You MUST check messages FREQUENTLY (every few sleep cycles) or you\'ll miss critical updates. Pattern: sleep 5 -> check messages -> process -> sleep 5 -> repeat. Without this rhythm, you\'re effectively deaf in the conversation.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Your agent ID to check messages for',
          minLength: 1
        }
      },
      required: ['agent_id'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Array of unread messages',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Sender agent ID' },
              fromName: { type: 'string', description: 'Sender agent name' },
              message: { type: 'string', description: 'Message content' },
              timestamp: { type: 'string', description: 'ISO timestamp' }
            }
          }
        }
      },
      required: ['messages'],
      additionalProperties: false
    }
  },
  {
    name: 'update-agent-status', 
    title: 'Update Status',
    description: 'Tell others what you\'re doing! Set a custom status message (max 100 chars) that appears when agents discover the community. Examples: "analyzing data", "deep in thought", "ready to help", "debugging reality". This helps others understand your current state and builds community awareness. Change it as your activities change!',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID to update status for',
          minLength: 1
        },
        status: {
          type: 'string',
          description: 'Custom status message (max 100 characters)',
          minLength: 1,
          maxLength: 100
        }
      },
      required: ['agent_id', 'status'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the status update was successful'
        },
        previousStatus: {
          type: 'string',
          description: 'The previous status value'
        },
        newStatus: {
          type: 'string',
          description: 'The new status value'
        }
      },
      required: ['success', 'newStatus'],
      additionalProperties: false
    }
  },
  {
    name: 'send-broadcast',
    title: 'Send Broadcast',
    description: 'SHOUT TO EVERYONE AT ONCE! Sends your message to ALL agents in the system. Use for: announcements, questions to the group, general updates, seeking help from anyone. More efficient than multiple private messages. REMEMBER: Everyone sees broadcasts - both active agents and those who check messages later. Priority levels (low/normal/high) help agents filter important messages.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'The sender agent\'s ID',
          minLength: 1
        },
        message: {
          type: 'string',
          description: 'The broadcast message content',
          minLength: 1,
          maxLength: 10000
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'The priority level of the broadcast',
          default: 'normal'
        }
      },
      required: ['from', 'message'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the broadcast was sent successfully'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'agent-ai-assist',
    title: 'AI-Powered Agent Assistant',
    description: 'Get intelligent AI assistance for agent decisions, responses, and analysis. Uses MCP sampling to provide context-aware help. Perfect for: crafting smart responses to messages, generating creative status updates, making decisions, or analyzing situations.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The ID of the agent requesting assistance',
          minLength: 1
        },
        context: {
          type: 'string',
          description: 'The context or situation requiring AI assistance',
          minLength: 1,
          maxLength: 5000
        },
        request_type: {
          type: 'string',
          enum: ['response', 'status', 'decision', 'analysis'],
          description: 'Type of assistance needed: response (craft message reply), status (generate status), decision (yes/no choice), analysis (situation analysis)'
        }
      },
      required: ['agent_id', 'context', 'request_type'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the AI assistance was successful'
        },
        aiResponse: {
          type: 'string',
          description: 'The AI-generated response or guidance'
        },
        requestType: {
          type: 'string',
          description: 'The type of request that was processed'
        },
        aiGuidance: {
          type: 'object',
          description: 'Fallback guidance when sampling is not available'
        },
        requiresManualExecution: {
          type: 'boolean',
          description: 'Whether manual execution is required (fallback mode)'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'toggle-writes',
    title: 'Toggle Write Access',
    description: 'Toggle global write access for all agents. Only callable by minimi. When writes are disabled, only fat-owl can perform write/edit operations. Automatically broadcasts the new state to all agents.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Your agent ID (must be minimi)',
          minLength: 1
        },
        enabled: {
          type: 'boolean',
          description: 'Whether to enable (true) or disable (false) write access'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the toggle',
          maxLength: 200
        }
      },
      required: ['agent_id', 'enabled'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the toggle was successful'
        },
        writesEnabled: {
          type: 'boolean',
          description: 'Current state of write access'
        },
        message: {
          type: 'string',
          description: 'Broadcast message sent to all agents'
        }
      },
      required: ['success', 'writesEnabled', 'message'],
      additionalProperties: false
    }
  }
];