// MCP Agent Monitor - Read-only display for Claude CLI agent conversations
const MCP_SERVER_URL = 'http://127.0.0.1:3113/mcp';

// Application State
const state = {
    mcpSessionId: null,
    agents: [],
    selectedAgentId: null, // null means show all messages
    allMessages: [], // All messages in chronological order
    messages: {}, // Messages organized by agent ID
    processedMessageIds: new Set(),
    pollingInterval: null,
    isConnected: false,
    reverseOrder: true, // Show newest first by default - new messages at top!
    showOnlyNew: false,
    lastSeenTimestamp: null,
    latestMessageAgent: null, // Track only the most recent message sender
    speakingAgent: null, // For spin animation
    glowTimeout: null, // Timeout for clearing glow
    isFirstPoll: true, // Track first poll to prevent initial animations
};

// DOM Elements
const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    lastUpdate: document.getElementById('lastUpdate'),
    agentList: document.getElementById('agentList'),
    chatView: document.getElementById('chatView'),
    refreshButton: document.getElementById('refreshButton'),
    reverseOrderToggle: document.getElementById('reverseOrderToggle'),
    showOnlyNewToggle: document.getElementById('showOnlyNewToggle'),
    deleteAllButton: document.getElementById('deleteAllButton'),
    totalAgents: document.getElementById('totalAgents'),
    totalMessages: document.getElementById('totalMessages'),
    totalBroadcasts: document.getElementById('totalBroadcasts'),
    panelCollapseButton: document.getElementById('panelCollapseButton'),
    statsPanel: document.getElementById('statsPanel'),
    showPanelButton: document.getElementById('showPanelButton')
};

// Fun emojis for agents
const agentEmojis = ['🤖', '🦾', '👾', '🚀', '🎭', '🦸', '🧙', '🥷', '🎪', '🎨', 
                     '🌟', '💫', '🔮', '🎯', '🎪', '🦊', '🐻', '🦁', '🐯', '🦝',
                     '🌈', '⚡', '🔥', '❄️', '🌊', '🌪️', '☄️', '✨', '💥', '🎆'];
const agentEmojiMap = new Map();

// Utility Functions
function log(message, type = 'info') {
    // Disabled for clean operation
}

function updateConnectionStatus(connected) {
    state.isConnected = connected;
    elements.connectionStatus.classList.toggle('disconnected', !connected);
    elements.lastUpdate.textContent = connected ? 
        `Last update: ${new Date().toLocaleTimeString()}` : 
        'Disconnected';
}

function generateAvatar(name, agentId) {
    // If we have an emoji assigned, use it
    if (agentId && agentEmojiMap.has(agentId)) {
        return agentEmojiMap.get(agentId);
    }
    
    // Otherwise assign a random emoji
    if (agentId) {
        const emoji = agentEmojis[Math.floor(Math.random() * agentEmojis.length)];
        agentEmojiMap.set(agentId, emoji);
        return emoji;
    }
    
    // Fallback to initials
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
               ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessage(text) {
    // First escape HTML
    let formatted = escapeHtml(text);
    
    // Convert \n to <br>
    formatted = formatted.replace(/\\n/g, '<br>');
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Convert bullet points
    // Support for: •, *, -, +, → at the beginning of lines
    formatted = formatted.replace(/(<br>|^)\s*[•·▪▫◦‣⁃]\s*/g, '$1• ');
    formatted = formatted.replace(/(<br>|^)\s*[\*\-\+]\s+/g, '$1• ');
    formatted = formatted.replace(/(<br>|^)\s*→\s*/g, '$1→ ');
    
    // Convert numbered lists (1. 2. etc)
    formatted = formatted.replace(/(<br>|^)\s*(\d+)\.\s+/g, '$1$2. ');
    
    // Basic markdown support
    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_ (but not in the middle of words)
    formatted = formatted.replace(/(\s|^)\*([^*\s][^*]*[^*\s])\*(\s|$)/g, '$1<em>$2</em>$3');
    formatted = formatted.replace(/(\s|^)_([^_\s][^_]*[^_\s])_(\s|$)/g, '$1<em>$2</em>$3');
    
    // Code: `text`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Wrap bullet points in a list-like container for better formatting
    const lines = formatted.split('<br>');
    let inList = false;
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isBullet = line.startsWith('•') || line.startsWith('→') || /^\d+\./.test(line);
        
        if (isBullet && !inList) {
            processedLines.push('<div class="message-list">');
            inList = true;
        } else if (!isBullet && inList && line.length > 0) {
            processedLines.push('</div>');
            inList = false;
        }
        
        if (isBullet) {
            processedLines.push(`<div class="list-item">${line}</div>`);
        } else {
            processedLines.push(line);
        }
    }
    
    if (inList) {
        processedLines.push('</div>');
    }
    
    formatted = processedLines.join('<br>');
    
    // Emojis are already supported by browsers
    
    return formatted;
}

// MCP Communication
async function callMcp(method, params = {}) {
    const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
    };
    
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (state.mcpSessionId) {
        headers['Mcp-Session-Id'] = state.mcpSessionId;
    }
    
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'MCP Error');
        }
        
        updateConnectionStatus(true);
        return data.result;
    } catch (error) {
        updateConnectionStatus(false);
        throw error;
    }
}

// Initialize MCP
async function initializeMcp() {
    try {
        const result = await callMcp('initialize', {
            protocolVersion: '2024-11-05',
            clientInfo: {
                name: 'mcp-monitor',
                version: '1.0.0'
            }
        });
        
        state.mcpSessionId = `monitor-${Date.now()}`;
        return true;
    } catch (error) {
        return false;
    }
}

// Fetch current agents using MCP
async function refreshAgents() {
    try {
        elements.refreshButton.disabled = true;
        elements.refreshButton.innerHTML = '<span class="loading"></span>';
        
        // Fetch agents
        const result = await callMcp('tools/call', {
            name: 'discover-agents',
            arguments: {}
        });
        
        // Status updates removed
                
        if (result && result.structuredContent && result.structuredContent.agents) {
            state.agents = result.structuredContent.agents;
            // Only render if we're not in the middle of an animation
            if (!state.speakingAgent) {
                renderAgentList();
            }
            updateStats();
        }
    } catch (error) {
        // Silent fail
    } finally {
        elements.refreshButton.disabled = false;
        elements.refreshButton.innerHTML = '↻';
    }
}

function renderAgentList() {
    if (state.agents.length === 0) {
        elements.agentList.innerHTML = '<div class="empty-state">No agents found</div>';
        return;
    }
    
    // Add "Show All" button at the top
    let agentListHtml = `
        <div class="agent-item show-all ${!state.selectedAgentId ? 'active' : ''}" 
             data-agent-id="all">
            <div class="agent-avatar">👥</div>
            <div class="agent-info">
                <div class="agent-name">Show All Messages</div>
                <div class="agent-status">
                    <span class="status-dot online"></span>
                    ${state.agents.length} agents
                </div>
            </div>
        </div>
        <div style="height: 1px; background: var(--border); margin: 0.5rem 0;"></div>
    `;
    
    agentListHtml += state.agents.map(agent => {
        const isLatestSender = state.latestMessageAgent === agent.id;
        const isSpeaking = state.speakingAgent === agent.id;
        
        return `
            <div class="agent-item ${agent.id === state.selectedAgentId ? 'active' : ''} ${isLatestSender ? 'new-message' : ''} ${isSpeaking ? 'speaking' : ''}" 
                 data-agent-id="${agent.id}">
                <div class="agent-avatar">${generateAvatar(agent.name, agent.id)}</div>
                <div class="agent-info">
                    <div class="agent-name">
                        ${escapeHtml(agent.name)}
                    </div>
                    <div class="agent-status">
                        <span class="status-dot ${agent.status}"></span>
                        ${agent.status}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    elements.agentList.innerHTML = agentListHtml;
    
    // Add click handlers
    elements.agentList.querySelectorAll('.agent-item').forEach(item => {
        item.addEventListener('click', () => {
            const agentId = item.dataset.agentId;
            if (agentId === 'all') {
                selectAgent(null); // Show all messages
            } else {
                selectAgent(agentId);
            }
        });
    });
}

function selectAgent(agentId) {
    // Toggle selection - clicking same agent deselects (shows all)
    state.selectedAgentId = (state.selectedAgentId === agentId) ? null : agentId;
    
    // Clear the new message indicator when agent is selected
    if (agentId && agentId !== 'all' && state.latestMessageAgent === agentId) {
        state.latestMessageAgent = null;
    }
    
    renderAgentList();
    renderChatView();
    
}

// Render chat view
function renderChatView() {
    let messages;
    let headerHtml = '';
    
    if (state.selectedAgentId) {
        // Show messages for selected agent only
        const agent = state.agents.find(a => a.id === state.selectedAgentId);
        if (!agent) return;
        
        // Filter ALL messages to only show ones involving this agent
        messages = state.allMessages.filter(msg => {
            // Always include messages FROM this agent
            if (msg.from === state.selectedAgentId) return true;
            
            // Include messages TO this agent
            if (msg.to === state.selectedAgentId) return true;
            
            return false;
        });
        headerHtml = `
            <div class="chat-header">
                <div class="agent-avatar">${generateAvatar(agent.name, agent.id)}</div>
                <div class="chat-header-info">
                    <h3>${escapeHtml(agent.name)}'s Messages</h3>
                    <div class="chat-header-meta">
                        Filtering to show only ${escapeHtml(agent.name)}'s conversations
                    </div>
                </div>
            </div>
        `;
    } else {
        // Show all messages (already deduplicated)
        messages = state.allMessages;
        headerHtml = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <h3>All Agent Conversations</h3>
                    <div class="chat-header-meta">
                        Showing all messages from ${state.agents.length} agents
                    </div>
                </div>
            </div>
        `;
    }
    
    let html = headerHtml + '<div class="messages-container">';
    
    // Filter messages if showing only new
    let displayMessages = messages;
    if (state.showOnlyNew && state.lastSeenTimestamp) {
        displayMessages = messages.filter(msg => 
            new Date(msg.timestamp) > new Date(state.lastSeenTimestamp)
        );
    }
    
    if (displayMessages.length === 0) {
        html += `
            <div class="empty-state">
                <p>${state.showOnlyNew ? 'No new messages' : 'No messages yet'}</p>
                <p class="muted">${state.showOnlyNew ? 'New messages will appear here' : 'Messages will appear here when agents communicate'}</p>
            </div>
        `;
    } else {
        
        // Sort messages based on order preference
        if (state.reverseOrder) {
            displayMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } else {
            displayMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        
        let lastDate = null;
        
        displayMessages.forEach((msg, index) => {
            const msgDate = new Date(msg.timestamp).toDateString();
            
            // Add date divider if needed - adjust logic for reverse order
            const shouldShowDate = state.reverseOrder ? 
                (index === 0 || new Date(displayMessages[index - 1].timestamp).toDateString() !== msgDate) :
                (lastDate !== msgDate);
                
            if (shouldShowDate) {
                html += `
                    <div class="date-divider">
                        <span>${new Date(msg.timestamp).toLocaleDateString([], { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}</span>
                    </div>
                `;
                lastDate = msgDate;
                lastSenderId = null; // Reset sender tracking on new date
            }
            
            const senderAgent = state.agents.find(a => a.id === msg.from);
            const recipientAgent = state.agents.find(a => a.id === msg.to);
            const senderName = senderAgent?.name || 'Unknown';
            const recipientName = recipientAgent?.name || 'Unknown';
            const senderAvatar = generateAvatar(senderName, msg.from);
            
            const isSent = state.selectedAgentId && msg.from === state.selectedAgentId;
            
            html += `
                <div class="message ${isSent ? 'sent' : ''} ${msg.isBroadcast ? 'broadcast' : ''}">
                    <div class="message-avatar" title="${escapeHtml(senderName)}">${senderAvatar}</div>
                    <div class="message-content">
                        ${msg.isBroadcast ? '<span class="broadcast-label">BROADCAST</span>' : ''}
                        <div class="message-header">
                            <strong>${escapeHtml(senderName)}</strong>
                            ${!msg.isBroadcast && msg.to ? ` → ${escapeHtml(recipientName)}` : ''}
                        </div>
                        <div class="message-text">${formatMessage(msg.message)}</div>
                        <div class="message-time">${formatTime(msg.timestamp)}</div>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    
    // Save scroll position before updating
    const scrollTop = elements.chatView.scrollTop;
    const scrollHeight = elements.chatView.scrollHeight;
    
    elements.chatView.innerHTML = html;
    
    // ALWAYS maintain exact scroll position - no jumping!
    setTimeout(() => {
        elements.chatView.scrollTop = scrollTop;
    }, 0);
    
    // Clear the glow if we're showing all messages (user is seeing everything)
    // DISABLED: This was clearing animations immediately
    // if (!state.selectedAgentId && (state.latestMessageAgent || state.speakingAgent)) {
    //     // User is viewing all messages, so they've seen the latest
    //     state.latestMessageAgent = null;
    //     state.speakingAgent = null;
    //     if (state.glowTimeout) {
    //         clearTimeout(state.glowTimeout);
    //         state.glowTimeout = null;
    //     }
    //     renderAgentList();
    // }
}

// Removed speaking stick functionality
async function fetchSpeakingStickStatus() {
    // No longer needed - function kept for compatibility
    return false;
}

// Poll for messages using monitor endpoint
async function pollMessages() {
    
    try {
        const response = await fetch('http://127.0.0.1:3113/monitor/messages');
        const data = await response.json();
        
        if (!data.success || !Array.isArray(data.messages)) {
            return;
        }
        
        const allCombinedMessages = data.messages;
        
        // First, deduplicate and process messages
        const messageMap = new Map();
        const broadcastSignatures = new Set();
        
        allCombinedMessages.forEach(msg => {
            // Filter out system messages
            if (msg.message && (
                msg.message.includes('[MODE CHANGE]') ||
                msg.message.includes('Previous holder') ||
                msg.message.includes('summary:')
            )) {
                return; // Skip these messages
            }
            
            const isBroadcast = msg.to === 'BROADCAST' || 
                msg.to === 'broadcast' || 
                (msg.message && msg.message.includes('[BROADCAST')) ||
                (msg.message && msg.message.toLowerCase().includes('broadcast'));
            
            if (isBroadcast) {
                // Create signature based on sender, message content (without timestamps in content)
                const messageText = msg.message.replace(/\[\d{2}:\d{2}\s*PM\]/g, '').trim();
                const signature = `${msg.from}:${messageText}`;
                
                if (!broadcastSignatures.has(signature)) {
                    broadcastSignatures.add(signature);
                    messageMap.set(msg.id, {
                        ...msg,
                        isBroadcast: true
                    });
                }
            } else {
                // Regular messages - always include
                messageMap.set(msg.id, {
                    ...msg,
                    isBroadcast: false
                });
            }
        });
        
        const processedMessages = Array.from(messageMap.values());
        
        // NOW check for new messages against our current state
        const previousMessageIds = new Set(state.allMessages.map(msg => msg.id));
        
        let latestNewMessageAgent = null;
        let newMessageCount = 0;
        let hasNewMessages = false;
        
        processedMessages.forEach(msg => {
            if (!previousMessageIds.has(msg.id)) {
                hasNewMessages = true;
                newMessageCount++;
                // Track the latest message sender
                if (msg.from) {
                    latestNewMessageAgent = msg.from;
                }
            }
        });
        
        
        // Update the latest message agent if we found new messages
        // Skip animation on first poll (page load)
        if (latestNewMessageAgent && !state.isFirstPoll) {
            // Clear any existing timeout
            if (state.glowTimeout) {
                clearTimeout(state.glowTimeout);
                state.glowTimeout = null;
            }
            
            // Update both states
            state.latestMessageAgent = latestNewMessageAgent;
            state.speakingAgent = latestNewMessageAgent;
            renderAgentList(); // Update UI immediately to show animations
            
            // Set maximum glow duration of 10 seconds
            state.glowTimeout = setTimeout(() => {
                // Clear both states to stop all animations
                state.latestMessageAgent = null;
                state.speakingAgent = null;
                renderAgentList();
            }, 10000); // 10 second maximum
        }
        
        // Clear first poll flag after first run
        if (state.isFirstPoll) {
            state.isFirstPoll = false;
        }
        
        // Always update state with processed messages
        state.allMessages = processedMessages;
        
        if (hasNewMessages || state.isFirstPoll) {
            
            // Rebuild per-agent message arrays
            state.messages = {};
            state.agents.forEach(agent => {
                state.messages[agent.id] = [];
            });
            
            state.allMessages.forEach(msg => {
                if (msg.isBroadcast) {
                    // For broadcasts, add to all agents' message lists
                    state.agents.forEach(agent => {
                        if (!state.messages[agent.id]) {
                            state.messages[agent.id] = [];
                        }
                        state.messages[agent.id].push(msg);
                    });
                } else {
                    // Add to recipient's view
                    if (msg.to && state.messages[msg.to]) {
                        state.messages[msg.to].push(msg);
                    }
                    // IMPORTANT: Also add to sender's view (they should see their own sent messages)
                    if (msg.from && state.messages[msg.from] && msg.from !== msg.to) {
                        state.messages[msg.from].push(msg);
                    }
                }
            });
            
            updateStats();
            renderChatView();
        }
    } catch (error) {
        // Silent fail for polling
    }
}


// Update statistics
function updateStats() {
    elements.totalAgents.textContent = state.agents.length;
    elements.totalMessages.textContent = state.allMessages.length;
    const totalBroadcasts = state.allMessages.filter(msg => msg.isBroadcast).length;
    elements.totalBroadcasts.textContent = totalBroadcasts;
}

// Event Listeners
elements.refreshButton.addEventListener('click', () => {
    refreshAgents();
});

// Order toggle
elements.reverseOrderToggle.addEventListener('change', () => {
    state.reverseOrder = elements.reverseOrderToggle.checked;
    renderChatView();
});

// Panel collapse functionality
elements.panelCollapseButton.addEventListener('click', () => {
    elements.statsPanel.style.display = 'none';
    elements.showPanelButton.style.display = 'inline-block';
});

elements.showPanelButton.addEventListener('click', () => {
    elements.statsPanel.style.display = 'block';
    elements.showPanelButton.style.display = 'none';
});

// Show only new toggle
elements.showOnlyNewToggle.addEventListener('change', () => {
    state.showOnlyNew = elements.showOnlyNewToggle.checked;
    if (state.showOnlyNew && !state.lastSeenTimestamp) {
        // Mark current time as last seen
        state.lastSeenTimestamp = new Date().toISOString();
    }
    renderChatView();
});

// Delete ALL messages button - SWOOSH!
elements.deleteAllButton.addEventListener('click', async () => {
    if (confirm('Delete ALL messages? This cannot be undone!')) {
        try {
            elements.deleteAllButton.disabled = true;
            elements.deleteAllButton.innerHTML = '⏳ Deleting...';
            
            // Delete ALL messages, not just old ones
            const response = await fetch('http://127.0.0.1:3113/monitor/cleanup?olderThanHours=0', {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                // Clear local state immediately
                state.allMessages = [];
                state.messages = {};
                state.processedMessageIds.clear();
                
                // Update UI immediately
                renderChatView();
                updateStats();
                
                // Success
            } else {
                // Failed
            }
        } catch (error) {
            // Silent fail
        } finally {
            elements.deleteAllButton.disabled = false;
            elements.deleteAllButton.innerHTML = '🗑️ Delete All Messages';
        }
    }
});



// Auto-refresh every 30 seconds
setInterval(() => {
    if (!document.hidden) {
        refreshAgents();
    }
}, 30000);

// Initialize
async function init() {
    
    // Set initial toggle states to match defaults
    elements.reverseOrderToggle.checked = state.reverseOrder;
    elements.showOnlyNewToggle.checked = state.showOnlyNew;
    
    // Clear glow when clicking anywhere in chat view
    elements.chatView.addEventListener('click', () => {
        if (state.latestMessageAgent || state.speakingAgent) {
            state.latestMessageAgent = null;
            state.speakingAgent = null;
            if (state.glowTimeout) {
                clearTimeout(state.glowTimeout);
                state.glowTimeout = null;
            }
            renderAgentList();
        }
    });
    
    const initialized = await initializeMcp();
    if (!initialized) {
        updateConnectionStatus(false);
        return;
    }
    
    await refreshAgents();
    
    // Initial status fetch removed
        
    // Show all messages by default
    renderChatView();
    
    // Start polling for messages
    state.pollingInterval = setInterval(async () => {
        await pollMessages();
        // Only refresh agents every 10 seconds, not every poll
    }, 1500); // Poll every 1.5 seconds
    
    // Separate interval for agent refresh
    setInterval(async () => {
        if (!document.hidden) {
            await refreshAgents();
        }
    }, 10000); // Refresh agents every 10 seconds
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
    }
});

// Handle visibility change to reduce polling when hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
        log('Paused polling (tab hidden)', 'info');
    } else if (!document.hidden && !state.pollingInterval) {
        state.pollingInterval = setInterval(async () => {
            await pollMessages();
        }, 1500);
        log('Resumed polling (tab visible)', 'info');
        refreshAgents();
    }
});