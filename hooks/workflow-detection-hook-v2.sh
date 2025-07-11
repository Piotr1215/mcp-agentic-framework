#!/bin/bash
# Workflow Detection Hook for MCP Agentic Framework - V2
# More robust version with better pattern matching

# Read JSON input from stdin
json_input=$(cat)

# Extract tool name and message content
tool_name=$(echo "$json_input" | jq -r '.tool_name // empty')
message=$(echo "$json_input" | jq -r '.tool_input.message // empty')

# Only process send-message and send-broadcast tools
if [[ "$tool_name" != "mcp__agentic-framework__send-message" && "$tool_name" != "mcp__agentic-framework__send-broadcast" ]]; then
    exit 0
fi

# Convert message to lowercase for case-insensitive matching
lower_message=$(echo "$message" | tr '[:upper:]' '[:lower:]')

# Check for workflow keywords with more flexible matching
workflow_detected=""
workflow_guidance=""

# Code Review
if [[ "$lower_message" =~ code[[:space:]]+review ]]; then
    workflow_detected="code review"
    workflow_guidance="Code Review Workflow: 1) Analyze code for quality issues 2) Check for security vulnerabilities 3) Provide feedback and suggestions 4) Approve or request changes"
# System Update
elif [[ "$lower_message" =~ system[[:space:]]+update ]]; then
    workflow_detected="system update"
    workflow_guidance="System Update Workflow: 1) Verify backup status 2) Test in staging environment 3) Apply updates incrementally 4) Monitor system health 5) Rollback if needed"
# Bug Fix
elif [[ "$lower_message" =~ bug[[:space:]]+fix ]] || [[ "$lower_message" =~ fix[[:space:]]+.*bug ]]; then
    workflow_detected="bug fix"
    workflow_guidance="Bug Fix Workflow: 1) Reproduce the issue 2) Identify root cause 3) Implement fix 4) Write tests 5) Verify fix works"
# Deploy/Deployment
elif [[ "$lower_message" =~ deploy ]]; then
    workflow_detected="deployment"
    workflow_guidance="Deployment Workflow: 1) Run all tests 2) Build release artifacts 3) Deploy to staging 4) Verify staging 5) Deploy to production"
# Incident
elif [[ "$lower_message" =~ incident ]]; then
    workflow_detected="incident response"
    workflow_guidance="Incident Response: 1) Assess severity 2) Notify stakeholders 3) Implement immediate fix 4) Document incident 5) Post-mortem analysis"
fi

# If workflow detected, provide guidance
if [[ -n "$workflow_detected" ]]; then
    # Use jq for proper JSON encoding
    jq -n \
        --arg user_feedback "🔗 Workflow detected: $workflow_detected

$workflow_guidance" \
        --arg llm_feedback "A workflow reference was detected in the message. Consider following this workflow: $workflow_guidance" \
        '{feedback_user: $user_feedback, feedback_llm: $llm_feedback}'
    exit 0
fi

# No workflow detected, allow normal processing
exit 0