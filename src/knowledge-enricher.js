/**
 * Knowledge enricher for automatic message enhancement
 * Adds relevant resource links to agent messages
 */

import { extractResourceUris } from './resource-translator.js';

/**
 * Extract key terms from a message for knowledge search
 * @param {string} message - The message to analyze
 * @returns {array} Array of search terms
 */
export function extractKeyTerms(message) {
  // Simple implementation - can be enhanced with NLP
  const stopWords = new Set(['i', 'am', 'the', 'is', 'at', 'on', 'for', 'with', 'to', 'a', 'an']);
  
  // Extract words, filter short ones and stop words
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Return unique terms
  return [...new Set(words)];
}

/**
 * Enrich a message with knowledge suggestions
 * @param {string} message - The original message
 * @param {function} searchFunction - Function to search knowledge base
 * @returns {object} Enriched message with knowledge suggestions
 */
export async function enrichMessageWithKnowledge(message, searchFunction) {
  const terms = extractKeyTerms(message);
  
  if (terms.length === 0) {
    return {
      message,
      enriched: false,
      suggestions: []
    };
  }
  
  // Search for each term and collect unique resources
  const allResources = new Map();
  
  for (const term of terms.slice(0, 3)) { // Limit to first 3 terms
    try {
      const searchResult = await searchFunction(term);
      const resources = extractResourceUris(searchResult);
      
      resources.forEach(resource => {
        if (!allResources.has(resource.uri)) {
          allResources.set(resource.uri, {
            ...resource,
            matchedTerms: [term]
          });
        } else {
          allResources.get(resource.uri).matchedTerms.push(term);
        }
      });
    } catch (error) {
      console.error(`Failed to search for term "${term}":`, error.message);
    }
  }
  
  // Sort by relevance (number of matched terms)
  const suggestions = Array.from(allResources.values())
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
    .slice(0, 3); // Top 3 suggestions
  
  if (suggestions.length === 0) {
    return {
      message,
      enriched: false,
      suggestions: []
    };
  }
  
  // Create enriched message
  const enrichedMessage = `${message}\n\n📚 Related knowledge:`;
  const enrichedParts = [enrichedMessage];
  
  suggestions.forEach(suggestion => {
    enrichedParts.push(`• ${suggestion.name}: ${suggestion.uri}`);
  });
  
  return {
    message: enrichedParts.join('\n'),
    originalMessage: message,
    enriched: true,
    suggestions
  };
}

/**
 * Format knowledge suggestions for display
 * @param {array} suggestions - Array of resource suggestions
 * @returns {string} Formatted suggestions
 */
export function formatKnowledgeSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '';
  }
  
  const lines = ['💡 Knowledge resources:'];
  suggestions.forEach(s => {
    lines.push(`  • ${s.name} (matched: ${s.matchedTerms.join(', ')})`);
    lines.push(`    ${s.uri}`);
  });
  
  return lines.join('\n');
}