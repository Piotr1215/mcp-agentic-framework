#!/bin/bash

# Test the workflow detection logic
test_messages=(
    "Team, we need to start a code review process"
    "Critical system update required tonight"
    "I found a bug fix is needed"
    "Ready to deploy to production"
    "Major incident detected"
    "Let's do a deployment"
    "We have an incident response situation"
)

# Define workflow patterns
declare -A workflows=(
    ["code review"]="Code Review Workflow"
    ["system update"]="System Update Workflow"
    ["bug fix"]="Bug Fix Workflow"
    ["deploy"]="Deployment Workflow"
    ["incident"]="Incident Response"
)

echo "Testing workflow detection..."
echo "============================="

for message in "${test_messages[@]}"; do
    echo -e "\nMessage: $message"
    lower_message=$(echo "$message" | tr '[:upper:]' '[:lower:]')
    
    detected=false
    for keyword in "${!workflows[@]}"; do
        if [[ "$lower_message" == *"$keyword"* ]]; then
            echo "  ✓ Detected: $keyword"
            detected=true
            break
        fi
    done
    
    if [ "$detected" = false ]; then
        echo "  ✗ No workflow detected"
    fi
done