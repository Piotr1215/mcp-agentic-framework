export const speakingStickDefinitions = [
  {
    name: 'grant-speaking-stick-to',
    title: 'Grant Speaking Stick To',
    description: 'Grant speaking stick to a specific agent (ruler only)',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        granting_agent: {
          type: 'string',
          description: 'ID of the ruler granting the stick',
          minLength: 1
        },
        target_agent: {
          type: 'string',
          description: 'ID of the agent to receive the stick',
          minLength: 1
        },
        topic: {
          type: 'string',
          description: 'Topic for discussion',
          maxLength: 200,
          default: ''
        },
        privilege_level: {
          type: 'string',
          enum: ['standard', 'expert', 'deep-analysis', 'leadership'],
          description: 'What enhanced capabilities to grant',
          default: 'standard'
        }
      },
      required: ['granting_agent', 'target_agent'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        granted: {
          type: 'boolean',
          description: 'Whether the speaking stick was granted'
        },
        ruler: {
          type: 'string',
          description: 'ID of the ruler'
        },
        current_holder: {
          type: 'string',
          description: 'ID of new speaking stick holder'
        },
        current_holder_name: {
          type: 'string',
          description: 'Name of new speaking stick holder'
        },
        privileges_granted: {
          type: 'array',
          items: { type: 'string' },
          description: 'Special abilities granted to the holder'
        },
        enhanced_prompt: {
          type: 'string',
          description: 'The enhanced prompt modification they receive'
        }
      },
      required: ['granted'],
      additionalProperties: false
    }
  },
  {
    name: 'request-speaking-stick',
    title: 'Request Speaking Stick (Deprecated)',
    description: 'Request exclusive communication rights with enhanced privileges',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        requesting_agent: {
          type: 'string',
          description: 'ID of the agent requesting the speaking stick',
          minLength: 1
        },
        topic: {
          type: 'string',
          description: 'What the agent wants to discuss',
          minLength: 1,
          maxLength: 200
        },
        urgent: {
          type: 'boolean',
          description: 'Whether to jump to front of queue',
          default: false
        },
        privilege_level: {
          type: 'string',
          enum: ['standard', 'expert', 'deep-analysis', 'leadership'],
          description: 'What enhanced capabilities they want',
          default: 'standard'
        }
      },
      required: ['requesting_agent', 'topic'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        granted: {
          type: 'boolean',
          description: 'Whether the speaking stick was granted'
        },
        current_holder: {
          type: ['string', 'null'],
          description: 'ID of current speaking stick holder'
        },
        simple_queue: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agents waiting for the stick'
        },
        violation_count: {
          type: 'number',
          description: 'Number of times this agent violated speaking rules'
        },
        privileges_granted: {
          type: 'array',
          items: { type: 'string' },
          description: 'Special abilities activated for the holder'
        },
        enhanced_prompt: {
          type: 'string',
          description: 'The enhanced prompt modification they receive'
        }
      },
      required: ['granted'],
      additionalProperties: false
    }
  },
  {
    name: 'release-speaking-stick',
    title: 'Release Speaking Stick',
    description: 'Release the speaking stick and notify the next agent',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        releasing_agent: {
          type: 'string',
          description: 'ID of the agent releasing the stick',
          minLength: 1
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was discussed',
          maxLength: 500
        },
        pass_to_specific: {
          type: 'string',
          description: 'ID of specific agent to pass to (skips queue)'
        }
      },
      required: ['releasing_agent'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        released: {
          type: 'boolean',
          description: 'Whether the stick was successfully released'
        },
        next_holder: {
          type: ['string', 'null'],
          description: 'ID of the next stick holder'
        },
        queue_updated: {
          type: 'boolean',
          description: 'Whether the queue was modified'
        },
        notification_sent: {
          type: 'boolean',
          description: 'Whether next agent was notified'
        }
      },
      required: ['released'],
      additionalProperties: false
    }
  },
  {
    name: 'set-communication-mode',
    title: 'Set Communication Mode',
    description: 'Switch between chaos and speaking-stick modes',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['chaos', 'speaking-stick'],
          description: 'The communication mode to set'
        },
        initiated_by: {
          type: 'string',
          description: 'ID of who requested the mode change',
          minLength: 1
        },
        enforcement_level: {
          type: 'string',
          enum: ['suggestion', 'prompt-modification', 'social-pressure'],
          description: 'How strictly to enforce the mode'
        }
      },
      required: ['mode', 'initiated_by', 'enforcement_level'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        previous_mode: {
          type: 'string',
          description: 'The previous communication mode'
        },
        new_mode: {
          type: 'string',
          description: 'The new communication mode'
        },
        enforcement_active: {
          type: 'boolean',
          description: 'Whether enforcement is active'
        },
        agents_notified: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agents who were notified'
        }
      },
      required: ['previous_mode', 'new_mode'],
      additionalProperties: false
    }
  },
  {
    name: 'track-speaking-violation',
    title: 'Track Speaking Violation',
    description: 'Record when an agent violates speaking stick rules',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        violating_agent: {
          type: 'string',
          description: 'ID of the agent who violated rules',
          minLength: 1
        },
        violation_type: {
          type: 'string',
          enum: ['spoke-without-stick', 'ignored-stick-mode', 'excessive-chatter'],
          description: 'Type of violation'
        },
        context: {
          type: 'string',
          description: 'Context of what happened',
          maxLength: 200
        }
      },
      required: ['violating_agent', 'violation_type'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        total_violations: {
          type: 'number',
          description: 'Total violations for this agent'
        },
        consequence_applied: {
          type: 'string',
          description: 'What consequence was applied'
        },
        social_pressure_level: {
          type: 'string',
          enum: ['none', 'mild', 'moderate', 'shame'],
          description: 'Current shame level'
        },
        prompt_modified: {
          type: 'boolean',
          description: 'Whether agent prompt was updated'
        }
      },
      required: ['total_violations'],
      additionalProperties: false
    }
  },
  {
    name: 'nudge-silent-agents',
    title: 'Nudge Silent Agents',
    description: 'Identify agents who have gone silent and need nudging',
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
        silent_agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent IDs who are silent'
        },
        last_activity: {
          type: 'object',
          description: 'Map of agent ID to last activity timestamp'
        },
        suggested_nudges: {
          type: 'object',
          description: 'Map of agent ID to suggested nudge message'
        },
        speaking_stick_queue: {
          type: 'array',
          items: { type: 'string' },
          description: 'Current speaking stick queue'
        }
      },
      required: ['silent_agents'],
      additionalProperties: false
    }
  },
  {
    name: 'get-speaking-stick-status',
    title: 'Get Speaking Stick Status',
    description: 'Get the current status of the speaking stick system including mode, holder, queue, and violations',
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
        mode: {
          type: 'string',
          enum: ['chaos', 'speaking-stick'],
          description: 'Current communication mode'
        },
        enforcement_level: {
          type: 'string',
          enum: ['suggestion', 'prompt-modification', 'social-pressure'],
          description: 'Current enforcement level'
        },
        current_holder: {
          type: ['string', 'null'],
          description: 'ID of current stick holder'
        },
        current_holder_name: {
          type: ['string', 'null'],
          description: 'Name of current stick holder'
        },
        current_holder_privileges: {
          type: 'array',
          items: { type: 'string' },
          description: 'Privileges granted to current holder'
        },
        stick_available: {
          type: 'boolean',
          description: 'Whether the stick is available to request'
        },
        queue_length: {
          type: 'number',
          description: 'Number of agents waiting'
        },
        queue: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              position: { type: 'number' },
              urgent: { type: 'boolean' }
            }
          },
          description: 'Detailed queue information'
        },
        total_violations: {
          type: 'number',
          description: 'Total violations across all agents'
        }
      },
      required: ['mode', 'enforcement_level'],
      additionalProperties: false
    }
  },
  {
    name: 'force-reset-speaking-stick',
    title: 'Force Reset Speaking Stick',
    description: 'Emergency reset of speaking stick when holder is invalid/disconnected',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        initiated_by: {
          type: 'string',
          description: 'ID of agent initiating the reset',
          minLength: 1
        }
      },
      required: ['initiated_by'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        reset: {
          type: 'boolean',
          description: 'Whether the reset was successful'
        },
        previous_holder: {
          type: ['string', 'null'],
          description: 'ID of previous stick holder'
        },
        cleared_queue_length: {
          type: 'number',
          description: 'Number of agents that were in queue'
        }
      },
      required: ['reset'],
      additionalProperties: false
    }
  }
];