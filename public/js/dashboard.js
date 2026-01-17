const socket = io();

// --- Socket Events ---

socket.on('connect', () => {
    addLog('Connected to dashboard server.', 'system');
});

socket.on('log', (data) => {
    // data = { message, type }
    addLog(data.message, data.type);
});

socket.on('status', (status) => {
    updateStatus(status);
});

socket.on('auth-code', (data) => {
    showAuthModal(data);
});

// --- UI Helpers ---

function addLog(message, type) {
    const container = document.getElementById('console-logs');
    if (!container) return; // Not on console page

    const div = document.createElement('div');
    div.className = getTypeClass(type);
    div.textContent = message;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function getTypeClass(type) {
    switch (type) {
        case 'error': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        case 'action': return 'text-blue-400 font-bold';
        case 'chat': return 'text-green-400';
        case 'system': return 'text-gray-500 italic';
        default: return 'text-gray-300';
    }
}

function updateStatus(status) {
    // Update Sidebar
    const sbDot = document.getElementById('sidebar-status-dot');
    const sbText = document.getElementById('sidebar-status-text');
    if (sbDot) sbDot.className = `w-2 h-2 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`;
    if (sbText) sbText.textContent = status.online ? 'Online' : 'Offline';

    // Update Dashboard Cards
    const mainDot = document.getElementById('status-dot');
    const mainText = document.getElementById('status-text');
    const userText = document.getElementById('bot-username');
    const uptimeText = document.getElementById('uptime-text');
    const authStatus = document.getElementById('auth-status');

    if (mainDot) mainDot.className = `w-3 h-3 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`;
    if (mainText) mainText.textContent = status.online ? 'Online' : 'Offline';
    if (userText) userText.textContent = status.username || 'N/A';
    if (userText) userText.title = status.username || '';
    if (uptimeText) uptimeText.textContent = status.uptime;
    if (authStatus) {
        authStatus.textContent = status.authStatus;
        authStatus.className = `text-xl font-bold ${status.authStatus === 'Verified' ? 'text-green-500' : 'text-yellow-500'}`;
    }
}

// --- Controls ---

async function controlBot(action) {
    try {
        const res = await fetch(`/api/${action}`, { method: 'POST' });
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
    // Toggle logic: we ask user what to do since we don't track state locally perfectly yet
    if (confirm("Start AFK Mode? (Cancel to Stop AFK)")) {
        await fetch('/api/afk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } else {
         await fetch('/api/afk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false })
        });
    }
}

async function sendCommand(e) {
    e.preventDefault();
    const input = document.getElementById('command-input');
    const command = input.value;
    if (!command) return;

    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        input.value = '';
        addLog(`> ${command}`, 'action');
    } catch(err) {
        console.error(err);
    }
}

// --- Settings Forms ---

async function updateServer(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        await fetch('/api/settings/server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        alert('Server settings saved.');
    } catch(err) { alert('Error saving settings'); }
}

async function updateAccount(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        await fetch('/api/settings/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        alert('Account settings saved.');
    } catch(err) { alert('Error saving settings'); }
}

async function updateGeneral(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Checkbox hack: if checked it exists, if not it doesn't.
    // But FormData includes it only if checked.
    // However, updateSettings expects boolean.
    // Wait, my control.js expects `autoReconnect` in body.
    // HTML Checkbox: <input type="checkbox" name="autoReconnect">
    // If checked, data.autoReconnect = 'on'. If not, undefined.

    const payload = {
        autoReconnect: !!data.autoReconnect
    };

    try {
        await fetch('/api/settings/general', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert('General settings saved.');
        location.reload();
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
