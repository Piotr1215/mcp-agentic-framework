# MCP Agentic Framework Justfile

# Default values
docker_user := "piotrzan"
kubeconfig := "/home/decoder/dev/homelab/kubeconfig"

# Show available commands
default:
    @just --list

# Get current version from package.json
get-version:
    @cat package.json | jq -r '.version'

# Bump patch version (1.0.0 -> 1.0.1)
bump-patch:
    npm version patch --no-git-tag-version

# Bump minor version (1.0.0 -> 1.1.0)
bump-minor:
    npm version minor --no-git-tag-version

# Bump major version (1.0.0 -> 2.0.0)
bump-major:
    npm version major --no-git-tag-version

# Build Docker image with version tag
build version=`just get-version`:
    docker build -t {{docker_user}}/mcp-agentic-framework:{{version}} .
    docker tag {{docker_user}}/mcp-agentic-framework:{{version}} {{docker_user}}/mcp-agentic-framework:latest

# Push Docker image to registry
push version=`just get-version`:
    docker push {{docker_user}}/mcp-agentic-framework:{{version}}
    docker push {{docker_user}}/mcp-agentic-framework:latest

# Update Kubernetes deployment
deploy version=`just get-version`:
    #!/usr/bin/env bash
    set -euo pipefail
    export KUBECONFIG={{kubeconfig}}
    
    echo "Deploying version {{version}} to Kubernetes..."
    kubectl set image deployment/mcp-agentic-framework mcp-server={{docker_user}}/mcp-agentic-framework:{{version}}
    kubectl rollout status deployment/mcp-agentic-framework --timeout=60s
    
    echo "✅ Deployment complete!"
    kubectl get pods -l app=mcp-agentic-framework

# Full update workflow: bump patch, build, push, deploy
update: bump-patch
    @echo "📦 Building and deploying new version..."
    @just build
    @just push
    @just deploy
    @echo "🎉 Update complete! New version: $(just get-version)"

# Update with minor version bump
update-minor: bump-minor
    @just build
    @just push
    @just deploy
    @echo "🎉 Update complete! New version: $(just get-version)"

# Update with major version bump
update-major: bump-major
    @just build
    @just push
    @just deploy
    @echo "🎉 Update complete! New version: $(just get-version)"

# Check deployment status
status:
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    echo "🔍 MCP Deployment Status:"
    kubectl get deployment mcp-agentic-framework
    echo ""
    echo "📦 Pods:"
    kubectl get pods -l app=mcp-agentic-framework
    echo ""
    echo "🌐 Services:"
    kubectl get svc mcp-agentic-framework mcp-agentic-framework-lb
    echo ""
    echo "📊 Current image:"
    kubectl get deployment mcp-agentic-framework -o jsonpath='{.spec.template.spec.containers[0].image}'
    echo ""

# View logs
logs tail="50":
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    kubectl logs -l app=mcp-agentic-framework --tail={{tail}} -f

# Restart deployment (useful for testing)
restart:
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    kubectl rollout restart deployment/mcp-agentic-framework
    kubectl rollout status deployment/mcp-agentic-framework

# Test the health endpoint
test-health:
    @curl -s http://192.168.178.91:3113/health | jq .

# Run locally for development
run-local:
    npm run start:http

# Clean up old images locally
clean-images:
    docker image prune -f
    docker images {{docker_user}}/mcp-agentic-framework --format "table \{\{.Tag\}\}\t\{\{.ID\}\}\t\{\{.CreatedAt\}\}" | tail -n +2 | sort -r | tail -n +6 | awk '{print $2}' | xargs -r docker rmi || true

# Rollback to previous version
rollback:
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    kubectl rollout undo deployment/mcp-agentic-framework
    kubectl rollout status deployment/mcp-agentic-framework
    echo "✅ Rollback complete!"

# Apply all K8s manifests
apply-manifests:
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/loadbalancer-service.yaml

# Delete deployment (careful!)
delete-deployment:
    #!/usr/bin/env bash
    export KUBECONFIG={{kubeconfig}}
    echo "⚠️  This will delete the MCP deployment!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete deployment mcp-agentic-framework
        echo "Deployment deleted"
    else
        echo "Cancelled"
    fi