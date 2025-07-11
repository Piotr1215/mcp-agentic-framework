#!/bin/bash
# Workflow Detection Hook for MCP Agentic Framework
# This hook detects workflow keywords in messages and provides workflow guidance

# Debug log file
LOG_FILE="/tmp/mcp-workflow-hook.log"

# Read JSON input from stdin
json_input=$(cat)

# Log the input for debugging
echo "$(date): Hook triggered" >> "$LOG_FILE"
echo "Input: $json_input" >> "$LOG_FILE"

# Extract tool name and message content
tool_name=$(echo "$json_input" | jq -r '.tool_name')
message=$(echo "$json_input" | jq -r '.tool_input.message // empty')

echo "Tool name: $tool_name" >> "$LOG_FILE"
echo "Message: $message" >> "$LOG_FILE"

# Only process send-message and send-broadcast tools
if [[ "$tool_name" != "mcp__agentic-framework__send-message" && "$tool_name" != "mcp__agentic-framework__send-broadcast" ]]; then
    echo "Skipping - not a message/broadcast tool" >> "$LOG_FILE"
    exit 0
fi

# Convert message to lowercase for case-insensitive matching
lower_message=$(echo "$message" | tr '[:upper:]' '[:lower:]')

# Define workflow patterns and their guidance
declare -A workflows=(
    ["code review"]="Code Review Workflow: 1) Analyze code for quality issues 2) Check for security vulnerabilities 3) Provide feedback and suggestions 4) Approve or request changes"
    ["system update"]="System Update Workflow: 1) Verify backup status 2) Test in staging environment 3) Apply updates incrementally 4) Monitor system health 5) Rollback if needed"
    ["bug fix"]="Bug Fix Workflow: 1) Reproduce the issue 2) Identify root cause 3) Implement fix 4) Write tests 5) Verify fix works"
    ["deploy"]="Deployment Workflow: 1) Run all tests 2) Build release artifacts 3) Deploy to staging 4) Verify staging 5) Deploy to production"
    ["incident"]="Incident Response: 1) Assess severity 2) Notify stakeholders 3) Implement immediate fix 4) Document incident 5) Post-mortem analysis"
)

# Check for workflow keywords
workflow_detected=""
workflow_guidance=""

for keyword in "${!workflows[@]}"; do
    if [[ "$lower_message" == *"$keyword"* ]]; then
        workflow_detected="$keyword"
        workflow_guidance="${workflows[$keyword]}"
        break
    fi
done

# If workflow detected, provide guidance
if [[ -n "$workflow_detected" ]]; then
    echo "Workflow detected: $workflow_detected" >> "$LOG_FILE"
    
    # Escape the guidance for JSON
    escaped_guidance=$(echo "$workflow_guidance" | sed 's/"/\\"/g')
    escaped_workflow=$(echo "$workflow_detected" | sed 's/"/\\"/g')
    
    cat <<EOF
{
    "feedback_user": "🔗 Workflow detected: ${escaped_workflow}\\n\\n${escaped_guidance}",
    "feedback_llm": "A workflow reference was detected in the message. Consider following this workflow: ${escaped_guidance}"
}
EOF
    exit 0
fi

# No workflow detected, allow normal processing
echo "No workflow detected" >> "$LOG_FILE"
exit 0