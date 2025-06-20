/**
 * Formats tool responses according to MCP specification
 */

/**
 * Creates a text response
 * @param {string} text - The text content
 * @param {object} [metadata] - Optional execution metadata
 * @returns {object} MCP-compliant response
 */
export function textResponse(text, metadata = null) {
  const response = {
    content: [
      {
        type: 'text',
        text
      }
    ]
  };
  
  if (metadata) {
    response._meta = metadata;
  }
  
  return response;
}

/**
 * Creates a structured response with both text and structured content
 * @param {object} data - The structured data
 * @param {string} [description] - Optional text description
 * @param {object} [metadata] - Optional execution metadata
 * @returns {object} MCP-compliant response
 */
export function structuredResponse(data, description = null, metadata = null) {
  const response = {
    content: [
      {
        type: 'text',
        text: description || JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data
  };
  
  if (metadata) {
    response._meta = metadata;
  }
  
  return response;
}

/**
 * Creates an error response
 * @param {Error|MCPError} error - The error to format
 * @returns {object} MCP-compliant error response
 */
export function errorResponse(error) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error.message}`
      }
    ],
    isError: true
  };
}

/**
 * Creates execution metadata for responses
 * @param {number} startTime - The start time from Date.now()
 * @param {object} [additional] - Additional metadata fields
 * @returns {object} Metadata object
 */
export function createMetadata(startTime, additional = {}) {
  return {
    executionTime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    ...additional
  };
}