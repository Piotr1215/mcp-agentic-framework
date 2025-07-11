# MCP Agentic Framework Hooks

This directory contains hook scripts for the MCP Agentic Framework that integrate with Claude Code's hook system.

## Workflow Detection Hook

The `workflow-detection-hook.sh` script detects workflow keywords in agent messages and provides workflow guidance.

### How it works

1. The hook runs before `send-message` and `send-broadcast` tool calls
2. It analyzes message content for workflow keywords (code review, system update, bug fix, deploy, incident)
3. When a workflow is detected, it provides:
   - User feedback showing the detected workflow and steps
   - LLM feedback suggesting to follow the workflow

### Supported Workflows

- **Code Review**: Quality analysis, security checks, feedback, approval process
- **System Update**: Backup verification, staging test, incremental updates, monitoring, rollback
- **Bug Fix**: Issue reproduction, root cause analysis, fix implementation, testing, verification
- **Deploy**: Test execution, build artifacts, staging deployment, verification, production deployment
- **Incident Response**: Severity assessment, stakeholder notification, immediate fix, documentation, post-mortem

### Installation

1. Make the hook executable:
   ```bash
   chmod +x workflow-detection-hook.sh
   ```

2. Add to your `~/.claude/settings.json`:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "mcp__agentic-framework__send-message|mcp__agentic-framework__send-broadcast",
           "hooks": [
             {
               "type": "command",
               "command": "/path/to/mcp-agentic-framework/hooks/workflow-detection-hook.sh"
             }
           ]
         }
       ]
     }
   }
   ```

### Customization

To add new workflows or modify existing ones:

1. Edit the `workflows` associative array in the script
2. Add your keyword and workflow steps
3. The hook will automatically detect the new patterns

### Example

When an agent sends: "I need to do a code review for the authentication module"

The hook will provide:
- **To User**: 🔗 Workflow detected: code review
  
  Code Review Workflow: 1) Analyze code for quality issues 2) Check for security vulnerabilities 3) Provide feedback and suggestions 4) Approve or request changes

- **To LLM**: A workflow reference was detected in the message. Consider following this workflow: [workflow steps]

This helps ensure consistent workflow execution across all agents in the system.