// MC Bot Admin Dashboard Client Script
// GitHub Primer UI/UX Design System Integration

const socket = io();
const isBotPage = typeof BOT_ID !== 'undefined';
let currentIsRunning = false;

// --- Global Toast Notification Utility (GitHub Primer Style) ---
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const toastStyles = {
        success: 'bg-canvas-default text-fg-default border-success-fg/50 border-l-4 border-l-success-fg',
        error: 'bg-canvas-default text-fg-default border-danger-fg/50 border-l-4 border-l-danger-fg',
        warning: 'bg-canvas-default text-fg-default border-attention-fg/50 border-l-4 border-l-attention-fg',
        info: 'bg-canvas-default text-fg-default border-accent-fg/50 border-l-4 border-l-accent-fg'
    };
    const iconNames = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    const iconColors = {
        success: 'text-success-fg',
        error: 'text-danger-fg',
        warning: 'text-attention-fg',
        info: 'text-accent-fg'
    };

    const styleClass = toastStyles[type] || toastStyles.info;
    const iconName = iconNames[type] || iconNames.info;
    const iconColor = iconColors[type] || iconColors.info;

    toast.className = `pointer-events-auto ${styleClass} shadow-lg border rounded-md p-3 flex items-start gap-2.5 text-xs font-medium toast-enter select-none transition-all`;
    toast.innerHTML = `
        <span class="material-icons text-base flex-shrink-0 ${iconColor} mt-0.5">${iconName}</span>
        <div class="flex-1 pr-2 leading-relaxed break-words text-fg-default">${message}</div>
        <button class="text-fg-muted hover:text-fg-default flex-shrink-0" onclick="this.parentElement.remove()">
            <span class="material-icons text-sm">close</span>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 150);
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

    card.setAttribute('data-bot-status', status.online ? 'online' : 'offline');

    const badge = card.querySelector('.bot-status-badge');
    const usernameEl = card.querySelector('.bot-username-text');
    const serverEl = card.querySelector('.bot-server-text');

    const isOnline = !!status.online;

    if (badge) {
        badge.className = `bot-status-badge px-2 py-0.5 text-[10px] font-mono font-medium rounded-pill border flex-shrink-0 flex items-center gap-1 ${
            isOnline 
                ? 'bg-success-subtle text-success-fg border-success-subtle'
                : 'bg-canvas-subtle text-fg-muted border-ghborder-default'
        }`;
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success-fg' : 'bg-fg-muted'}"></span><span>${isOnline ? 'Online' : 'Offline'}</span>`;
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
    div.className = getTypeClass(type) + " break-words leading-relaxed py-0.5 hover:bg-canvas-subtle/50 px-1 rounded";
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
        container.innerHTML = '<div class="text-fg-muted italic font-mono text-xs py-1">Console cleared.</div>';
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
                    container.innerHTML = '<div class="console-placeholder text-fg-muted italic font-mono text-xs py-2">No historical logs recorded. Ready for events.</div>';
                    return;
                }

                data.history.forEach(entry => {
                    const div = document.createElement('div');
                    div.className = getTypeClass(entry.type) + " break-words leading-relaxed py-0.5 hover:bg-canvas-subtle/50 px-1 rounded";
                    
                    let msg = entry.message || '';
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
        case 'error': return 'text-danger-fg font-medium';
        case 'warning': return 'text-attention-fg';
        case 'action': return 'text-accent-fg font-semibold';
        case 'chat': return 'text-success-fg';
        case 'output': return 'text-fg-default';
        case 'system': return 'text-fg-muted italic';
        default: return 'text-fg-default';
    }
}

// --- Status Updates ---

function updateStatus(status) {
    if (!status) return;

    currentIsRunning = !!status.isRunning;

    // Header status
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) dot.className = `w-2 h-2 rounded-full ${status.online ? 'bg-success-fg' : 'bg-danger-fg'}`;
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
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-success-subtle bg-success-subtle text-success-fg font-semibold rounded-pill';
        } else if (status.authStatus === 'Pending') {
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-attention-subtle bg-attention-subtle text-attention-fg font-semibold rounded-pill animate-pulse';
        } else {
            authStatus.className = 'font-mono text-xs uppercase px-2 py-0.5 border border-ghborder-default bg-canvas-default text-fg-muted font-semibold rounded-pill';
        }
    }

    // Bot details
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
            const colorClass = val > 15 ? 'text-success-fg' : val > 10 ? 'text-attention-fg' : 'text-danger-fg';
            detailHealth.className = `font-mono font-bold ${colorClass}`;
            const bar = document.getElementById('health-bar');
            if (bar) bar.style.width = Math.min(100, (val / 20) * 100) + '%';
        }
    }

    if (detailFood) {
        const val = status.food !== undefined && status.food !== '-' ? Number(status.food) : null;
        detailFood.textContent = val !== null ? `${val} / 20` : '-';
        if (val !== null) {
            const colorClass = val >= 15 ? 'text-success-fg' : val >= 7 ? 'text-attention-fg' : 'text-danger-fg';
            detailFood.className = `font-mono font-bold ${colorClass}`;
            const bar = document.getElementById('food-bar');
            if (bar) bar.style.width = Math.min(100, (val / 20) * 100) + '%';
        }
    }

    if (detailPosition) detailPosition.textContent = status.position !== undefined ? status.position : '-';
    if (detailDimension) detailDimension.textContent = status.dimension !== undefined ? status.dimension : '-';
}

function updateAfkButton(isAfkActive) {
    const btn = document.getElementById('afk-btn');
    if (!btn) return;
    
    if (isAfkActive) {
        btn.innerHTML = '<span class="w-2 h-2 rounded-full bg-success-fg"></span><span>Stop AFK Routine</span>';
        btn.className = 'px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 border border-success-subtle bg-success-subtle text-success-fg transition-colors';
    } else {
        btn.innerHTML = '<span class="w-2 h-2 rounded-full bg-fg-muted"></span><span>Start AFK Routine</span>';
        btn.className = 'px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 border border-ghborder-default bg-canvas-subtle text-fg-default hover:bg-canvas-default transition-colors';
    }
}

function updateStartStopButton(isRunning) {
    const startStopBtn = document.getElementById('start-stop-btn');
    const startStopIcon = document.getElementById('start-stop-icon');
    const startStopText = document.getElementById('start-stop-text');
    if (!startStopBtn) return;
    
    currentIsRunning = !!isRunning;

    if (isRunning) {
        startStopBtn.className = 'px-3 py-1.5 bg-danger-emphasis hover:bg-danger-fg text-white border border-danger-emphasis rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm';
        if (startStopIcon) startStopIcon.textContent = 'stop';
        if (startStopText) startStopText.textContent = 'Stop Bot';
    } else {
        startStopBtn.className = 'px-3 py-1.5 bg-success-emphasis hover:bg-success-fg text-white border border-success-emphasis rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm';
        if (startStopIcon) startStopIcon.textContent = 'play_arrow';
        if (startStopText) startStopText.textContent = 'Start Bot';
    }
}

// --- Control Actions ---

async function toggleStartStop() {
    if (!isBotPage) return;
    
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
        addLog(`$ ${command}`, 'output');
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
            email: data.email,
            type: data.accountType === 'offline' ? 'offline' : 'online'
        },
        name: data.name,
        serverProfile: data.serverProfile || null
    };

    if (data.version === 'custom') {
        payload.server.version = data.customVersion.trim();
    }

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
        setTimeout(() => modal.classList.add('hidden'), 150);
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
        copyBtn.innerHTML = '<span class="material-icons text-sm text-success-fg">check</span>';
        setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 2000);
    }

    showToast(`Code "${code}" copied to clipboard!`, 'success');
}
