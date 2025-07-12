import { promptDefinitions } from './promptDefinitions.js';

/**
 * Handle completion requests for prompts
 */
export async function handleCompletion(ref, argument) {
  // Only handle prompt completions
  if (ref.type !== 'ref/prompt') {
    return { completion: { values: [] } };
  }
  
  const prompt = promptDefinitions.find(p => p.name === ref.name);
  if (!prompt) {
    return { completion: { values: [] } };
  }
  
  const arg = prompt.arguments?.find(a => a.name === argument.name);
  if (!arg) {
    return { completion: { values: [] } };
  }
  
  // Provide completions based on argument name and current value
  const currentValue = argument.value || '';
  let suggestions = [];
  
  switch (argument.name) {
    case 'agent_name':
      // Suggest name patterns
      suggestions = [
        'DataBot',
        'AnalyzerAgent',
        'MonitorBot',
        'ProcessorAgent',
        'CoordinatorBot',
        'ValidatorAgent',
        'ReporterBot',
        'SchedulerAgent',
        'CollectorBot',
        'IntegratorAgent'
      ].filter(s => s.toLowerCase().includes(currentValue.toLowerCase()));
      break;
      
    case 'agent_role':
      // Suggest common agent roles
      suggestions = [
        'analyzes data patterns and trends',
        'coordinates multi-agent tasks',
        'monitors system health and performance',
        'processes incoming data streams',
        'validates data integrity and quality',
        'aggregates information from multiple sources',
        'generates reports and insights',
        'schedules and manages tasks',
        'collects metrics and statistics',
        'integrates with external systems'
      ].filter(s => s.toLowerCase().includes(currentValue.toLowerCase()));
      break;
      
    case 'announcement_type':
      // Fixed set of announcement types
      suggestions = ['update', 'question', 'alert']
        .filter(s => s.startsWith(currentValue.toLowerCase()));
      break;
      
    case 'include_messages':
      // Boolean values
      suggestions = ['true', 'false']
        .filter(s => s.startsWith(currentValue.toLowerCase()));
      break;
      
    case 'check_interval':
      // Common intervals with descriptions
      const intervals = [
        { value: '1', desc: 'Very frequent (1 second)' },
        { value: '5', desc: 'Default (5 seconds)' },
        { value: '10', desc: 'Moderate (10 seconds)' },
        { value: '15', desc: 'Relaxed (15 seconds)' },
        { value: '30', desc: 'Slow (30 seconds)' },
        { value: '60', desc: 'Very slow (1 minute)' }
      ];
      
      suggestions = intervals
        .filter(i => i.value.startsWith(currentValue))
        .map(i => i.desc ? `${i.value} - ${i.desc}` : i.value);
      break;
      
    case 'agent_id':
    case 'from_agent_id':
    case 'to_agent_id':
      // For agent IDs, provide format hints
      // In a real implementation, we could fetch active agents
      if (currentValue.length < 5) {
        suggestions = [
          'agent-1234567890',
          'agent-abc123',
          'agent-<unique-id>'
        ];
      } else {
        // Provide pattern-based suggestions
        suggestions = [
          currentValue + '123',
          currentValue + '-bot',
          currentValue + '-agent'
        ].slice(0, 10);
      }
      break;
      
    case 'topic':
      // Common conversation topics
      suggestions = [
        'status update',
        'collaboration request',
        'data analysis results',
        'error report',
        'performance metrics',
        'system health check',
        'task coordination',
        'resource allocation',
        'progress report',
        'help request',
        'configuration change',
        'deployment notification'
      ].filter(s => s.toLowerCase().includes(currentValue.toLowerCase()));
      break;
      
    case 'message':
      // Message templates based on prompt context
      if (ref.name === 'broadcast-announcement') {
        const announcementType = argument.context?.announcement_type || '';
        
        if (announcementType === 'alert') {
          suggestions = [
            'ALERT: System performance degradation detected',
            'ALERT: Critical error in data processing pipeline',
            'ALERT: Resource utilization exceeding threshold',
            'ALERT: Immediate attention required for...'
          ];
        } else if (announcementType === 'update') {
          suggestions = [
            'UPDATE: New feature deployed successfully',
            'UPDATE: Maintenance completed, all systems operational',
            'UPDATE: Data processing completed for batch...',
            'UPDATE: Configuration changes applied'
          ];
        } else if (announcementType === 'question') {
          suggestions = [
            'QUESTION: Has anyone experienced issues with...',
            'QUESTION: Can someone help with...',
            'QUESTION: What is the best approach for...',
            'QUESTION: Is there documentation for...'
          ];
        } else {
          // General templates
          suggestions = [
            'System maintenance scheduled for...',
            'New feature available: ...',
            'Requesting assistance with...',
            'Task completed successfully: ...',
            'Beginning analysis of...'
          ];
        }
        
        suggestions = suggestions
          .filter(s => s.toLowerCase().includes(currentValue.toLowerCase()));
      }
      break;
  }
  
  // Sort by relevance (prioritize starts-with matches)
  suggestions.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(currentValue.toLowerCase());
    const bStarts = b.toLowerCase().startsWith(currentValue.toLowerCase());
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.localeCompare(b);
  });
  
  // Limit to 100 items as per spec
  suggestions = suggestions.slice(0, 100);
  
  return {
    completion: {
      values: suggestions,
      total: suggestions.length,
      hasMore: false
    }
  };
}