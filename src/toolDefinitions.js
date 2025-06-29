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
          description: 'The unique identifier assigned to the agent'
        }
      },
      required: ['id'],
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
    title: 'Discover Agents',
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
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The unique identifier of the agent'
              },
              name: {
                type: 'string',
                description: 'The name of the agent'
              },
              description: {
                type: 'string',
                description: 'The description of the agent'
              }
            },
            required: ['id', 'name', 'description'],
            additionalProperties: false
          }
        }
      },
      required: ['agents'],
      additionalProperties: false
    }
  },
  {
    name: 'send-message',
    title: 'Send Message',
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
    title: 'Check for Messages',
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
          items: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'The ID of the sender agent'
              },
              message: {
                type: 'string',
                description: 'The message content'
              },
              timestamp: {
                type: 'string',
                description: 'ISO 8601 timestamp when the message was sent'
              }
            },
            required: ['from', 'message', 'timestamp'],
            additionalProperties: false
          }
        }
      },
      required: ['messages'],
      additionalProperties: false
    }
  },
  {
    name: 'update-agent-status',
    title: 'Update Agent Status',
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
          description: 'Your previous status'
        },
        newStatus: {
          type: 'string',
          description: 'Your new status'
        }
      },
      required: ['success'],
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
        type: {
          type: 'string',
          description: 'The type of response generated'
        },
        content: {
          type: 'string',
          description: 'The AI-generated content'
        },
        reasoning: {
          type: 'string',
          description: 'Explanation of the AI\'s reasoning (for decisions)'
        }
      },
      required: ['type', 'content'],
      additionalProperties: false
    }
  },
  {
    name: 'intelligent-broadcast',
    title: 'AI-Enhanced Broadcast',
    description: 'Send a broadcast with AI-enhanced formatting and priority detection. The AI analyzes your message content to suggest appropriate priority levels and can enhance the message for clarity.',
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
          description: 'The message to broadcast (AI may enhance it)',
          minLength: 1,
          maxLength: 5000
        },
        auto_priority: {
          type: 'boolean',
          description: 'Let AI determine the priority based on content',
          default: true
        },
        enhance_message: {
          type: 'boolean',
          description: 'Allow AI to enhance message clarity',
          default: false
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
        },
        final_message: {
          type: 'string',
          description: 'The actual message that was broadcast'
        },
        priority_used: {
          type: 'string',
          description: 'The priority level that was applied'
        },
        ai_reasoning: {
          type: 'string',
          description: 'AI\'s reasoning for priority/enhancements'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  }
];
