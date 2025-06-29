export const toolDefinitions = [
  {
    name: 'register-agent',
    title: 'Register Agent',
    description: 'Register a new agent in the communication framework',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The unique name identifier for the agent',
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: 'string',
          description: 'A description of the agent\'s role and capabilities',
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
    description: 'Unregister an agent from the communication framework',
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
    description: 'Discover all currently registered agents',
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
    description: 'Send a message from one agent to another',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The ID of the recipient agent',
          minLength: 1
        },
        from: {
          type: 'string',
          description: 'The ID of the sender agent',
          minLength: 1
        },
        message: {
          type: 'string',
          description: 'The message content to send',
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
    description: 'Check for messages sent to a specific agent',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The ID of the agent to check messages for',
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
    description: 'Update the status of an agent (online, offline, busy, away)',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The unique identifier of the agent',
          minLength: 1
        },
        status: {
          type: 'string',
          enum: ['online', 'offline', 'busy', 'away'],
          description: 'The new status for the agent'
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
          description: 'The previous status of the agent'
        },
        newStatus: {
          type: 'string',
          description: 'The new status of the agent'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'subscribe-to-notifications',
    title: 'Subscribe to Notifications',
    description: 'Subscribe an agent to receive specific types of notifications',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The unique identifier of the agent',
          minLength: 1
        },
        events: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of event patterns to subscribe to (e.g., "agent/*", "message/*", "broadcast/*")',
          minItems: 1
        }
      },
      required: ['agent_id', 'events'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the subscription was successful'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'unsubscribe-from-notifications',
    title: 'Unsubscribe from Notifications',
    description: 'Unsubscribe an agent from notifications',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The unique identifier of the agent',
          minLength: 1
        },
        events: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of event patterns to unsubscribe from. If not provided, unsubscribes from all'
        }
      },
      required: ['agent_id'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the unsubscription was successful'
        },
        message: {
          type: 'string',
          description: 'Additional information about the unsubscription'
        }
      },
      required: ['success'],
      additionalProperties: false
    }
  },
  {
    name: 'send-broadcast',
    title: 'Send Broadcast',
    description: 'Send a broadcast message to all agents',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'The unique identifier of the sender agent',
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
    name: 'get-pending-notifications',
    title: 'Get Pending Notifications',
    description: 'Retrieve pending notifications for an agent',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The unique identifier of the agent',
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
        notifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              jsonrpc: {
                type: 'string',
                description: 'JSON-RPC version'
              },
              method: {
                type: 'string',
                description: 'The notification method/type'
              },
              params: {
                type: 'object',
                description: 'The notification parameters'
              }
            },
            required: ['jsonrpc', 'method', 'params']
          }
        }
      },
      required: ['notifications'],
      additionalProperties: false
    }
  },
];
