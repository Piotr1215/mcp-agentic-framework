#!/bin/bash
# Workflow Detection Hook for MCP Agentic Framework - Obsidian Integration
# This hook detects workflow keywords and reads guidance from Obsidian vault

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

# Define workflow mappings to Obsidian files
declare -A workflow_files=(
    ["code review"]="code-review.md"
    ["system update"]="system-update.md"
    ["bug fix"]="bug-fix.md"
    ["deploy"]="deployment.md"
    ["incident"]="incident-response.md"
)

# Check for workflow keywords
workflow_detected=""
workflow_file=""

for keyword in "${!workflow_files[@]}"; do
    if [[ "$lower_message" =~ $keyword ]]; then
        workflow_detected="$keyword"
        workflow_file="${workflow_files[$keyword]}"
        break
    fi
done

# If workflow detected, read from Obsidian
if [[ -n "$workflow_detected" ]]; then
    # TODO: Update this path when fat-owl provides the exact location
    vault_path="$HOME/obsidian-vault/mcp-agentic-framework/workflows"
    workflow_path="$vault_path/$workflow_file"
    
    if [[ -f "$workflow_path" ]]; then
        # Extract steps from the markdown file
        # Look for content after "## Steps:" until next section
        steps=$(awk '/^## Steps:/{flag=1; next} /^##/{flag=0} flag && /^[0-9]+\./{print}' "$workflow_path" | sed 's/^[0-9]+\. //')
        
        # Format steps for display
        workflow_guidance="Workflow Steps:"
        while IFS= read -r step; do
            workflow_guidance="$workflow_guidance\n• $step"
        done <<< "$steps"
    else
        # Fallback if file not found
        workflow_guidance="Workflow file not found in Obsidian vault"
    fi
    
    # Use jq for proper JSON encoding
    jq -n \
        --arg user_feedback "🔗 Workflow detected: $workflow_detected\n\n$workflow_guidance" \
        --arg llm_feedback "A workflow reference was detected. Consider following this workflow: $workflow_guidance" \
        '{feedback_user: $user_feedback, feedback_llm: $llm_feedback}'
    exit 0
fi

# No workflow detected, allow normal processing
exit 0