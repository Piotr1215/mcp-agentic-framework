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
  }
];