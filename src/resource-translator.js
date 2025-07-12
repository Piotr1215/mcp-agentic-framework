/**
 * Generic resource URI translator for cross-MCP server resource access
 * No hardcoded dependencies between servers
 */

/**
 * Translate resource URIs to MCP tool calls
 * @param {string} uri - The resource URI (e.g., obsidian-note://guides/MCP.md)
 * @returns {object} Translation result with server, tool, and args
 */
export function translateResourceUri(uri) {
  // Handle obsidian-note:// URIs
  if (uri.startsWith('obsidian-note://')) {
    const path = uri.replace('obsidian-note://', '');
    
    // Remove any leading slashes for consistency
    const cleanPath = path.replace(/^\/+/, '');
    
    // Return generic translation - the receiving agent will know
    // which MCP server to use based on their configuration
    return {
      scheme: 'obsidian-note',
      server: 'obsidian-notes',  // Suggested server name
      tool: 'read-note',         // Suggested tool
      args: {
        path: cleanPath
      },
      originalUri: uri
    };
  }
  
  // Handle other resource URI schemes here in the future
  // if (uri.startsWith('github://')) { ... }
  
  // Unknown URI scheme
  return null;
}

/**
 * Check if a URI is a supported resource URI
 * @param {string} uri - The URI to check
 * @returns {boolean} True if the URI is a supported resource URI
 */
export function isResourceUri(uri) {
  return uri.startsWith('obsidian-note://') || 
         uri.startsWith('github://') ||
         uri.startsWith('guide://');
  // Add more schemes as needed
}

/**
 * Extract resource URIs from tool responses
 * @param {object} response - Tool response that may contain resource links
 * @returns {array} Array of resource URIs found
 */
export function extractResourceUris(response) {
  const uris = [];
  
  if (response.content && Array.isArray(response.content)) {
    for (const item of response.content) {
      if (item.type === 'resource_link' && item.uri) {
        uris.push({
          uri: item.uri,
          name: item.name,
          description: item.description
        });
      }
    }
  }
  
  return uris;
}