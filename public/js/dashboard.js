const socket = io();
const isBotPage = typeof BOT_ID !== 'undefined';

// Initial Request
if (isBotPage) {
    socket.emit('get-status', BOT_ID);
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
    container.scrollTop = container.scrollHeight;
}

function clearConsole() {
    const container = document.getElementById('console-logs');
    if (container) {
        container.innerHTML = '<div class="text-gray-500 italic">Console cleared.</div>';
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
    const btn = document.getElementById('afk-btn');
    const isStarting = btn.innerText.includes('Toggle') || btn.innerText.includes('Start');
    // Simplified toggle logic: server handles state, but we don't strictly know if it's on or off without status
    // For now, prompt:

    if (confirm("Enable AFK Mode?")) {
        await fetch(`/api/bot/${BOT_ID}/afk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } else {
         await fetch(`/api/bot/${BOT_ID}/afk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false })
        });
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
    if (!confirm("Are you sure you want to delete this bot? This action cannot be undone.")) return;

    try {
        const res = await fetch(`/api/bot/${BOT_ID}/delete`, { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        } else {
            alert("Failed to delete bot.");
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
