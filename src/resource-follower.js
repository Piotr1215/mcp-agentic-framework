/**
 * Resource follower for agents to navigate resource links
 */

import { translateResourceUri, isResourceUri, extractResourceUris } from './resource-translator.js';

/**
 * Get translation info for a resource URI
 * Note: This does NOT call any MCP tools - it just provides translation info
 * @param {string} uri - The resource URI to translate
 * @returns {object} Translation information
 */
export function getResourceTranslation(uri) {
  if (!isResourceUri(uri)) {
    throw new Error(`Unsupported resource URI: ${uri}`);
  }
  
  const translation = translateResourceUri(uri);
  if (!translation) {
    throw new Error(`Could not translate resource URI: ${uri}`);
  }
  
  return translation;
}

/**
 * Process a tool response and return both the response and extracted resource links
 * @param {object} response - Tool response
 * @returns {object} Processed response with resource links
 */
export function processResponseWithResources(response) {
  const resources = extractResourceUris(response);
  
  return {
    response,
    resources,
    hasResources: resources.length > 0
  };
}

/**
 * Helper to get resource info from a search response
 * @param {object} searchResponse - Response from a search tool
 * @param {number} index - Index of resource (0-based, optional)
 * @returns {object} Resource info or array of all resources
 */
export function getResourceFromResponse(searchResponse, index = null) {
  const processed = processResponseWithResources(searchResponse);
  
  if (!processed.hasResources) {
    throw new Error('No resource links found in response');
  }
  
  // Return all resources if no index specified
  if (index === null) {
    return processed.resources;
  }
  
  if (index >= processed.resources.length) {
    throw new Error(`Resource index ${index} out of range (found ${processed.resources.length} resources)`);
  }
  
  return processed.resources[index];
}