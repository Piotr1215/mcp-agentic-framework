#!/usr/bin/env bash
# Helper script to manage the MCP server tmux session

set -eo pipefail

MCP_SERVER_URL="${MCP_SERVER_URL:-http://127.0.0.1:3113}"
MCP_FRAMEWORK_DIR="/home/decoder/dev/mcp-agentic-framework"

# Function to check if MCP server is running
check_server() {
    curl -s "${MCP_SERVER_URL}/health" >/dev/null 2>&1
}

# Function to find server session
find_server_session() {
    tmux list-sessions 2>/dev/null | grep "^claude-server:" | cut -d: -f1
}

case "${1:-help}" in
    status)
        if check_server; then
            echo "MCP server is running at $MCP_SERVER_URL"
            session=$(find_server_session)
            if [ -n "$session" ]; then
                echo "Server session: $session"
            fi
        else
            echo "MCP server is not running"
            session=$(find_server_session)
            if [ -n "$session" ]; then
                echo "Found dead session: $session (will be cleaned up on next start)"
            fi
        fi
        ;;
        
    logs)
        session=$(find_server_session)
        if [ -n "$session" ]; then
            echo "Attaching to server session: $session"
            echo "Press Ctrl-B then D to detach"
            tmux attach-session -t "$session"
        else
            echo "No server session found"
            if check_server; then
                echo "Server is running but not in a tracked tmux session"
            fi
        fi
        ;;
        
    stop)
        echo "Stopping MCP server..."
        session=$(find_server_session)
        if [ -n "$session" ]; then
            tmux kill-session -t "$session" 2>/dev/null && echo "Stopped session: $session" || echo "Failed to stop session"
        fi
        
        # Also try to kill by PID if exists
        if [ -f /tmp/mcp-server.pid ]; then
            pid=$(cat /tmp/mcp-server.pid)
            kill "$pid" 2>/dev/null && echo "Killed process: $pid" || true
            rm -f /tmp/mcp-server.pid
        fi
        ;;
        
    start)
        if check_server; then
            echo "Server is already running"
            session=$(find_server_session)
            if [ -n "$session" ]; then
                echo "View logs with: $0 logs"
            fi
        else
            # Start server in tmux session
            session_name="claude-server"
            
            echo "Starting MCP server in tmux session: $session_name"
            
            cd "$MCP_FRAMEWORK_DIR"
            tmux new-session -d -s "$session_name" \
                "echo 'MCP HTTP Server - Session: $session_name'; \
                 echo 'Starting at $(date)'; \
                 echo ''; \
                 npm run start:http"
            
            # Wait for startup
            count=0
            while ! check_server && [ $count -lt 30 ]; do
                sleep 0.5
                count=$((count + 1))
            done
            
            if check_server; then
                echo "Server started successfully"
                echo "View logs with: $0 logs"
            else
                echo "Server failed to start"
                echo "Check logs with: $0 logs"
            fi
        fi
        ;;
        
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
        
    *)
        echo "MCP Server Manager"
        echo ""
        echo "Usage: $0 {status|start|stop|restart|logs}"
        echo ""
        echo "Commands:"
        echo "  status  - Check if server is running"
        echo "  start   - Start server in new tmux session"
        echo "  stop    - Stop server and kill tmux session"
        echo "  restart - Stop and start server"
        echo "  logs    - Attach to server tmux session to view logs"
        echo ""
        echo "Server URL: $MCP_SERVER_URL"
        ;;
esac