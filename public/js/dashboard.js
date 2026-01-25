const socket = io();
const isBotPage = typeof BOT_ID !== 'undefined';

// Initial Request
if (isBotPage) {
    socket.emit('get-status', BOT_ID);
    loadConsoleHistory();
}

// --- Socket Events ---

socket.on('connect', () => {
    if (isBotPage) {
        addLog('Connected to dashboard server.', 'system');
        socket.emit('get-status', BOT_ID);
    }
});

socket.on('log', (data) => {
    // data = { botId, message, type }
    if (isBotPage && data.botId == BOT_ID) {
        addLog(data.message, data.type);
    }
});

socket.on('status', (data) => {
    // data = { botId, status }
    if (isBotPage && data.botId == BOT_ID) {
        updateStatus(data.status);
    }
});

socket.on('auth-code', (data) => {
    // data = { botId, data: { user_code, ... } }
    if (isBotPage && data.botId == BOT_ID) {
        showAuthModal(data.data);
        addLog(`Auth Code: ${data.data.user_code}`, 'action');
    }
});

// --- UI Helpers ---

function addLog(message, type) {
    const container = document.getElementById('console-logs');
    if (!container) return;

    const div = document.createElement('div');
    div.className = getTypeClass(type) + " break-words";
    div.textContent = message;

    container.appendChild(div);
    
    // Only scroll to bottom if user is near the bottom (not viewing history)
    const isNearBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
    if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

async function clearConsole() {
    const container = document.getElementById('console-logs');
    if (container) {
        container.innerHTML = '<div class="text-gray-500 italic">Console cleared.</div>';
    }
    
    // Also clear the server-side history
    if (isBotPage) {
        try {
            await fetch(`/api/bot/${BOT_ID}/history/clear`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to clear server console history:', error);
        }
    }
}

async function loadConsoleHistory() {
    try {
        const response = await fetch(`/api/bot/${BOT_ID}/history?count=100`);
        const data = await response.json();
        
        if (data.success && data.history && Array.isArray(data.history)) {
            const container = document.getElementById('console-logs');
            if (container) {
                // Clear existing content except the connecting message
                container.innerHTML = '';
                
                // Add historical logs
                data.history.forEach(entry => {
                    const div = document.createElement('div');
                    div.className = getTypeClass(entry.type) + " break-words";
                    
                    // Format timestamp for display (convert ISO string to readable format)
                    const date = new Date(entry.timestamp);
                    const timeString = date.toLocaleTimeString();
                    div.textContent = `[${timeString}] ${entry.message}`;
                    
                    container.appendChild(div);
                });
                
                // Scroll to bottom
                container.scrollTop = container.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Failed to load console history:', error);
    }
}

function getTypeClass(type) {
    switch (type) {
        case 'error': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        case 'action': return 'text-blue-400 font-bold';
        case 'chat': return 'text-green-400';
        case 'output': return 'text-gray-300';
        case 'system': return 'text-gray-500 italic';
        default: return 'text-gray-300';
    }
}

function updateStatus(status) {
    // Update Header Status
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) dot.className = `w-2 h-2 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`;
    if (text) text.textContent = status.online ? 'Online' : 'Offline';

    // Update Start/Stop Button
    updateStartStopButton(status.isRunning);

    // Update AFK Button based on status
    updateAfkButton(status.isAfkActive);

    // Update Cards
    const userText = document.getElementById('bot-username');
    const uptimeText = document.getElementById('uptime-text');
    const authStatus = document.getElementById('auth-status');

    if (userText) userText.textContent = status.username || '-';
    if (uptimeText) uptimeText.textContent = status.uptime;
    if (authStatus) {
        authStatus.textContent = status.authStatus;
        authStatus.className = `font-bold ${status.authStatus === 'Verified' ? 'text-green-500' : 'text-yellow-500'}`;
    }

    // Update Bot Details Container
    const detailUsername = document.getElementById('detail-username');
    const detailHealth = document.getElementById('detail-health');
    const detailFood = document.getElementById('detail-food');
    const detailPosition = document.getElementById('detail-position');
    const detailDimension = document.getElementById('detail-dimension');

    if (detailUsername) detailUsername.textContent = status.username || '-';
    if (detailHealth) {
        detailHealth.textContent = status.health !== undefined ? status.health : '-';
        // Update color based on health value
        if (status.health !== undefined && !isNaN(status.health)) {
            detailHealth.className = 'font-bold';
            if (status.health > 15) {
                detailHealth.classList.add('text-green-500');
            } else if (status.health > 10) {
                detailHealth.classList.add('text-yellow-500');
            } else {
                detailHealth.classList.add('text-red-500');
            }
        }
    }
    if (detailFood) {
        detailFood.textContent = status.food !== undefined ? status.food : '-';
        // Update color based on food value
        if (status.food !== undefined && !isNaN(status.food)) {
            detailFood.className = 'font-bold';
            if (status.food >= 15) {
                detailFood.classList.add('text-green-500');
            } else if (status.food >= 7) {
                detailFood.classList.add('text-yellow-500');
            } else {
                detailFood.classList.add('text-red-500');
            }
        }
    }
    if (detailPosition) detailPosition.textContent = status.position !== undefined ? status.position : '-';
    if (detailDimension) detailDimension.textContent = status.dimension !== undefined ? status.dimension : '-';
}

function updateAfkButton(isAfkActive) {
    const btn = document.getElementById('afk-btn');
    if (!btn) return;
    
    // Update button text and appearance based on AFK state
    if (isAfkActive) {
        btn.innerHTML = '<span class="material-icons text-sm">cached</span> Stop AFK <span class="afk-status-indicator ml-1 w-2 h-2 rounded-full bg-green-500 inline-block"></span>';
        btn.classList.remove('bg-slate-100', 'dark:bg-slate-700', 'text-slate-700', 'dark:text-slate-200');
        btn.classList.add('bg-green-500', 'hover:bg-green-600', 'text-white');
    } else {
        btn.innerHTML = '<span class="material-icons text-sm">cached</span> Start AFK <span class="afk-status-indicator ml-1 w-2 h-2 rounded-full bg-red-500 inline-block"></span>';
        btn.classList.remove('bg-green-500', 'hover:bg-green-600', 'text-white');
        btn.classList.add('bg-slate-100', 'dark:bg-slate-700', 'text-slate-700', 'dark:text-slate-200');
    }
}

function updateStartStopButton(isRunning) {
    const startStopBtn = document.getElementById('start-stop-btn');
    const startStopIcon = document.getElementById('start-stop-icon');
    const startStopText = document.getElementById('start-stop-text');
    
    if (isRunning) {
        // Bot is running - show stop button
        startStopBtn.className = 'flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95';
        startStopIcon.textContent = 'stop';
        startStopText.textContent = 'Stop';
    } else {
        // Bot is stopped - show start button
        startStopBtn.className = 'flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 active:scale-95';
        startStopIcon.textContent = 'play_arrow';
        startStopText.textContent = 'Start';
    }
}

async function toggleStartStop() {
    if (!isBotPage) return;
    
    const statusElement = document.getElementById('status-text');
    const isCurrentlyRunning = statusElement && statusElement.textContent === 'Online';
    
    const action = isCurrentlyRunning ? 'stop' : 'start';
    try {
        const res = await fetch(`/api/bot/${BOT_ID}/${action}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to send command.');
    }
}

// --- Controls ---

async function controlBot(action) {
    if (!isBotPage) return;
    try {
        const res = await fetch(`/api/bot/${BOT_ID}/${action}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to send command.');
    }
}

async function toggleAfk() {
    if (!isBotPage) return;
    
    try {
        // Send undefined/null for enabled to make the server toggle the current state
        const res = await fetch(`/api/bot/${BOT_ID}/afk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: null }) // null means toggle current state
        });
        
        const data = await res.json();
        if (!data.success) {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to toggle AFK mode.');
    }
}

async function sendCommand(e) {
    e.preventDefault();
    if (!isBotPage) return;

    const input = document.getElementById('command-input');
    const command = input.value;
    if (!command) return;

    try {
        await fetch(`/api/bot/${BOT_ID}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        input.value = '';
        addLog(`> ${command}`, 'output');
    } catch(err) {
        console.error(err);
    }
}

async function deleteBot() {
    if (!isBotPage) return;
    
    // Get bot name to include in confirmation for better security
    const botName = document.querySelector('h2.text-xl')?.textContent || 'this bot';
    const confirmationText = `Are you sure you want to delete "${botName}"? This action cannot be undone and will permanently remove all associated data including console history.`;
    
    if (!confirm(confirmationText)) return;

    try {
        const res = await fetch(`/api/bot/${BOT_ID}/delete`, { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        } else {
            const errorData = await res.json();
            alert(errorData.message || "Failed to delete bot.");
        }
    } catch (e) {
        console.error(e);
        alert("Error deleting bot.");
    }
}

// --- Settings ---

async function updateBotConfig(e) {
    e.preventDefault();
    if (!isBotPage) return;

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Structure for API
    const payload = {
        server: {
            ip: data.ip,
            port: data.port,
            version: data.version
        },
        account: {
            email: data.email
        },
        name: data.name
    };

    try {
        await fetch(`/api/bot/${BOT_ID}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert('Settings saved. Restart the bot to apply changes.');
    } catch(err) { alert('Error saving settings'); }
}

// --- Auth Modal ---

function showAuthModal(data) {
    const modal = document.getElementById('auth-modal');
    const codeEl = document.getElementById('auth-code');
    const linkEl = document.getElementById('auth-link');

    if (modal && codeEl && linkEl) {
        codeEl.textContent = data.user_code;
        linkEl.href = data.verification_uri;
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function copyCode() {
    const code = document.getElementById('auth-code').textContent;
    navigator.clipboard.writeText(code);
    alert('Code copied!');
}
