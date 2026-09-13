// MC Bot Admin Dashboard Client Script
// Full Square Cyber-Tactical UI/UX

const socket = io();
const isBotPage = typeof BOT_ID !== 'undefined';
let currentIsRunning = false;

// --- Global Toast Notification Utility (Square Cyber-Brutalist HUD) ---
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderColors = {
        success: 'border-emerald-500 bg-obsidian-900 text-emerald-300',
        error: 'border-redstone-500 bg-obsidian-900 text-redstone-300',
        warning: 'border-amber-500 bg-obsidian-900 text-amber-300',
        info: 'border-primary bg-obsidian-900 text-slate-200'
    };
    const iconNames = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const colorClass = borderColors[type] || borderColors.info;
    const iconName = iconNames[type] || iconNames.info;

    toast.className = `pointer-events-auto border-l-4 ${colorClass} bg-white dark:bg-obsidian-900 shadow-xl border border-slate-200 dark:border-obsidian-700 p-3.5 flex items-start gap-3 text-xs font-medium toast-enter select-none transition-all`;
    toast.innerHTML = `
        <span class="material-icons text-base flex-shrink-0 mt-0.5">${iconName}</span>
        <div class="flex-1 pr-2 leading-relaxed break-words">${message}</div>
        <button class="text-slate-400 hover:text-slate-200 flex-shrink-0" onclick="this.parentElement.remove()">
            <span class="material-icons text-sm">close</span>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

// Initial Request
if (isBotPage) {
    socket.emit('get-status', BOT_ID);
    loadConsoleHistory();
}

// --- Socket Events ---

socket.on('connect', () => {
    if (isBotPage) {
        addLog('Connected to dashboard server stream.', 'system');
        socket.emit('get-status', BOT_ID);
    }
});

socket.on('disconnect', () => {
    if (isBotPage) {
        addLog('Disconnected from server stream. Attempting reconnection...', 'warning');
    }
});

socket.on('log', (data) => {
    if (isBotPage && String(data.botId) === String(BOT_ID)) {
        addLog(data.message, data.type);
    }
});

socket.on('status', (data) => {
    if (isBotPage && String(data.botId) === String(BOT_ID)) {
        updateStatus(data.status);
    }
    // Update main dashboard card if on home view
    updateDashboardCard(data.botId, data.status);
});

socket.on('bot-list', (bots) => {
    if (!isBotPage && Array.isArray(bots)) {
        bots.forEach(bot => {
            updateDashboardCard(bot.id, bot);
        });
    }
});

socket.on('auth-code', (data) => {
    if (isBotPage && String(data.botId) === String(BOT_ID)) {
        showAuthModal(data.data);
        addLog(`Microsoft Auth Required: Verification Code ${data.data.user_code}`, 'action');
    }
});

// --- Main Dashboard Realtime Card Updater ---

function updateDashboardCard(botId, status) {
    const card = document.querySelector(`[data-bot-card="${botId}"]`);
    if (!card || !status) return;

    const badge = card.querySelector('.bot-status-badge');
    const usernameEl = card.querySelector('.bot-username-text');
    const serverEl = card.querySelector('.bot-server-text');
    const pipEl = card.querySelector('.bot-status-pip');

    const isOnline = !!status.online;

    if (badge) {
        badge.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
        badge.className = `bot-status-badge px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase border ${
            isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-100 dark:bg-obsidian-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-obsidian-700'
        }`;
    }

    if (pipEl) {
        pipEl.className = `bot-status-pip w-2 h-2 inline-block ${isOnline ? 'bg-emerald-500' : 'bg-redstone-500'}`;
    }

    if (usernameEl && status.username) {
        usernameEl.textContent = status.username !== 'N/A' ? status.username : 'Not connected';
    }

    if (serverEl && status.server) {
        serverEl.textContent = `${status.server.ip}:${status.server.port}`;
    }
}

// --- Console Logs Helpers ---

function addLog(message, type) {
    const container = document.getElementById('console-logs');
    if (!container) return;

    // Remove placeholder connecting message if present
    const placeholder = container.querySelector('.console-placeholder');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    div.className = getTypeClass(type) + " break-words leading-relaxed py-0.5 hover:bg-white/[0.02]";
    div.textContent = message;

    container.appendChild(div);
    
    // Auto scroll if user is near bottom
    const isNearBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 60;
    if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

async function clearConsole() {
    const container = document.getElementById('console-logs');
    if (container) {
        container.innerHTML = '<div class="text-slate-500 italic font-mono text-xs py-1">Console cleared.</div>';
    }
    
    if (isBotPage) {
        try {
            await fetch(`/api/bot/${BOT_ID}/history/clear`, { method: 'POST' });
            showToast('Console history cleared.', 'info');
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
                container.innerHTML = '';
                
                if (data.history.length === 0) {
                    container.innerHTML = '<div class="console-placeholder text-slate-500 italic font-mono text-xs py-2">No historical logs recorded. Ready for events.</div>';
                    return;
                }

                data.history.forEach(entry => {
                    const div = document.createElement('div');
                    div.className = getTypeClass(entry.type) + " break-words leading-relaxed py-0.5 hover:bg-white/[0.02]";
                    
                    let msg = entry.message || '';
                    // Fix double timestamp bug: only prefix timestamp if message doesn't already start with '['
                    if (!msg.trim().startsWith('[')) {
                        const date = new Date(entry.timestamp);
                        const timeString = date.toLocaleTimeString();
                        msg = `[${timeString}] ${msg}`;
                    }
                    div.textContent = msg;
                    
                    container.appendChild(div);
                });
                
                container.scrollTop = container.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Failed to load console history:', error);
    }
}

function getTypeClass(type) {
    switch (type) {
        case 'error': return 'text-redstone-400 font-medium';
        case 'warning': return 'text-amber-400';
        case 'action': return 'text-blue-400 font-bold';
        case 'chat': return 'text-emerald-400';
        case 'output': return 'text-slate-300';
        case 'system': return 'text-slate-500 italic';
        default: return 'text-slate-300';
    }
}

// --- Status Updates ---

function updateStatus(status) {
    if (!status) return;

    currentIsRunning = !!status.isRunning;

    // Header status
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) dot.className = `w-2 h-2 inline-block ${status.online ? 'bg-emerald-500' : 'bg-redstone-500'}`;
    if (text) text.textContent = status.online ? 'Online' : 'Offline';

    // Buttons
    updateStartStopButton(status.isRunning);
    updateAfkButton(status.isAfkActive);

    // Status cards
    const userText = document.getElementById('bot-username');
    const uptimeText = document.getElementById('uptime-text');
    const authStatus = document.getElementById('auth-status');

    if (userText) userText.textContent = (status.username && status.username !== 'N/A') ? status.username : '-';
    if (uptimeText) uptimeText.textContent = status.uptime || '0s';
    if (authStatus) {
        authStatus.textContent = status.authStatus || 'Offline';
        if (status.authStatus === 'Verified') {
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold';
        } else if (status.authStatus === 'Pending') {
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold animate-pulse';
        } else {
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-slate-700 bg-slate-800 text-slate-400 font-bold';
        }
    }

    // Bot details (preserve typography classes)
    const detailUsername = document.getElementById('detail-username');
    const detailHealth = document.getElementById('detail-health');
    const detailFood = document.getElementById('detail-food');
    const detailPosition = document.getElementById('detail-position');
    const detailDimension = document.getElementById('detail-dimension');

    if (detailUsername) detailUsername.textContent = (status.username && status.username !== 'N/A') ? status.username : '-';
    
    if (detailHealth) {
        const val = status.health !== undefined && status.health !== '-' ? Number(status.health) : null;
        detailHealth.textContent = val !== null ? `${val} / 20` : '-';
        if (val !== null) {
            const colorClass = val > 15 ? 'text-emerald-400' : val > 10 ? 'text-amber-400' : 'text-redstone-400';
            detailHealth.className = `text-xs font-mono font-bold ${colorClass}`;
        } else {
            detailHealth.className = 'text-xs font-mono font-medium text-slate-500';
        }
    }

    if (detailFood) {
        const val = status.food !== undefined && status.food !== '-' ? Number(status.food) : null;
        detailFood.textContent = val !== null ? `${val} / 20` : '-';
        if (val !== null) {
            const colorClass = val >= 15 ? 'text-emerald-400' : val >= 7 ? 'text-amber-400' : 'text-redstone-400';
            detailFood.className = `text-xs font-mono font-bold ${colorClass}`;
        } else {
            detailFood.className = 'text-xs font-mono font-medium text-slate-500';
        }
    }

    if (detailPosition) detailPosition.textContent = status.position !== undefined ? status.position : '-';
    if (detailDimension) detailDimension.textContent = status.dimension !== undefined ? status.dimension : '-';
}

function updateAfkButton(isAfkActive) {
    const btn = document.getElementById('afk-btn');
    if (!btn) return;
    
    if (isAfkActive) {
        btn.innerHTML = '<span class="inline-block w-2 h-2 bg-emerald-400 mr-2"></span><span>Stop AFK</span>';
        btn.className = 'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 text-xs font-mono font-bold uppercase tracking-wider transition-all min-w-[120px] active:translate-y-0.5';
    } else {
        btn.innerHTML = '<span class="inline-block w-2 h-2 bg-slate-500 mr-2"></span><span>Start AFK</span>';
        btn.className = 'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-obsidian-700 hover:bg-slate-200 dark:hover:bg-obsidian-750 text-xs font-mono font-bold uppercase tracking-wider transition-all min-w-[120px] active:translate-y-0.5';
    }
}

function updateStartStopButton(isRunning) {
    const startStopBtn = document.getElementById('start-stop-btn');
    const startStopIcon = document.getElementById('start-stop-icon');
    const startStopText = document.getElementById('start-stop-text');
    if (!startStopBtn) return;
    
    currentIsRunning = !!isRunning;

    if (isRunning) {
        // Bot running -> Stop button (Redstone red, sharp square)
        startStopBtn.className = 'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-redstone-600 hover:bg-redstone-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all border border-redstone-500/50 shadow-sm active:translate-y-0.5 min-w-[120px]';
        if (startStopIcon) startStopIcon.textContent = 'stop';
        if (startStopText) startStopText.textContent = 'Stop Bot';
    } else {
        // Bot stopped -> Start button (Emerald green, sharp square)
        startStopBtn.className = 'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all border border-emerald-500/50 shadow-sm active:translate-y-0.5 min-w-[120px]';
        if (startStopIcon) startStopIcon.textContent = 'play_arrow';
        if (startStopText) startStopText.textContent = 'Start Bot';
    }
}

// --- Control Actions ---

async function toggleStartStop() {
    if (!isBotPage) return;
    
    // Determine action based on tracked state
    const action = currentIsRunning ? 'stop' : 'start';
    const startStopBtn = document.getElementById('start-stop-btn');
    const startStopText = document.getElementById('start-stop-text');

    if (startStopText) startStopText.textContent = action === 'stop' ? 'Stopping...' : 'Starting...';
    if (startStopBtn) startStopBtn.disabled = true;

    try {
        const res = await fetch(`/api/bot/${BOT_ID}/${action}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`Bot ${action === 'start' ? 'started' : 'stopped'} successfully.`, 'success');
        } else {
            showToast(`Error: ${data.message || data.error}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error sending command.', 'error');
    } finally {
        if (startStopBtn) startStopBtn.disabled = false;
    }
}

async function controlBot(action) {
    if (!isBotPage) return;
    try {
        const res = await fetch(`/api/bot/${BOT_ID}/${action}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`Command '${action}' dispatched successfully.`, 'success');
        } else {
            showToast(`Error: ${data.message || data.error}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to send control command.', 'error');
    }
}

async function toggleAfk() {
    if (!isBotPage) return;
    try {
        const res = await fetch(`/api/bot/${BOT_ID}/afk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: null })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('AFK state toggled.', 'info');
        } else {
            showToast(`Error: ${data.message || data.error}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to toggle AFK mode.', 'error');
    }
}

async function sendCommand(e) {
    e.preventDefault();
    if (!isBotPage) return;

    const input = document.getElementById('command-input');
    const command = input.value.trim();
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
        showToast('Failed to send command to bot.', 'error');
    }
}

async function deleteBot() {
    if (!isBotPage) return;
    
    const botName = document.querySelector('h2.bot-title')?.textContent || 'this bot';
    const confirmationText = `Are you sure you want to permanently delete "${botName}"?\n\nThis will purge all configuration and console logs.`;
    
    if (!confirm(confirmationText)) return;

    try {
        const res = await fetch(`/api/bot/${BOT_ID}/delete`, { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        } else {
            const errorData = await res.json();
            showToast(errorData.message || 'Failed to delete bot.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error deleting bot.', 'error');
    }
}

// --- Configuration Updates ---

async function updateBotConfig(e) {
    e.preventDefault();
    if (!isBotPage) return;

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

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
        const res = await fetch(`/api/bot/${BOT_ID}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok && (result.success !== false)) {
            showToast('Settings saved. Restart bot to apply changes.', 'success');
        } else {
            showToast(result.error || 'Failed to save settings.', 'error');
        }
    } catch(err) {
        console.error(err);
        showToast('Network error saving configuration.', 'error');
    }
}

// --- Microsoft Authentication Modal ---

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
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
}

function copyCode() {
    const codeEl = document.getElementById('auth-code');
    if (!codeEl) return;
    const code = codeEl.textContent.trim();
    navigator.clipboard.writeText(code);

    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="material-icons text-sm text-emerald-400">check</span>';
        setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 2000);
    }

    showToast(`Code "${code}" copied to clipboard!`, 'success');
}
