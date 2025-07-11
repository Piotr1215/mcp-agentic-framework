/**
 * Functional utility module for adding resource links to tool responses
 */

/**
 * Add resource links to metadata
 * @param {Object} metadata - The existing metadata object
 * @param {Array} resourceLinks - Array of resource link objects
 * @returns {Object} New metadata object with resource links
 */
export function addResourceLinks(metadata, resourceLinks) {
  if (!resourceLinks || resourceLinks.length === 0) {
    return metadata;
  }
  
  return {
    ...metadata,
    resource_links: resourceLinks
  };
}

/**
 * Create an agent profile resource link
 * @param {string} agentId - The agent ID
 * @param {string} agentName - The agent name
 * @returns {Object} Resource link object
 */
export function createAgentProfileLink(agentId, agentName) {
  return {
    uri: `agent://${agentId}/profile`,
    title: `${agentName} Profile`,
    description: `Detailed profile and capabilities for ${agentName}`
  };
}

/**
 * Create a conversation history resource link
 * @param {string} agent1Id - First agent ID
 * @param {string} agent2Id - Second agent ID
 * @returns {Object} Resource link object
 */
export function createConversationLink(agent1Id, agent2Id) {
  return {
    uri: `conversation://${agent1Id}/${agent2Id}`,
    title: 'Conversation History',
    description: 'Full conversation thread between agents'
  };
}


/**
 * Extract unique conversation participants from messages
 * @param {Array} messages - Array of message objects
 * @returns {Array} Array of unique participant pairs
 */
export function extractConversationPairs(messages) {
  const pairs = new Set();
  
  messages.forEach(msg => {
    if (msg.from && msg.to) {
      // Sort to ensure consistent ordering
      const pair = [msg.from, msg.to].sort();
      pairs.add(pair.join('/'));
    }
  });
  
  return Array.from(pairs).map(pair => {
    const [agent1, agent2] = pair.split('/');
    return createConversationLink(agent1, agent2);
  });
}

