const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').plugin;
const dataManager = require('../utils/dataManager');

let bot = null;
let io = null;
let isRunning = false;
let afkInterval = null;
let reconnectTimeout = null;
let shouldReconnect = false; // Flag to control auto-reconnect
let startTime = null;
let authStatus = 'Offline'; // Offline, Pending, Verified

function setIo(socketIo) {
    io = socketIo;
}

function logToConsole(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry); // Server console
    if (io) {
        io.emit('log', { message: logEntry, type });
    }
}

function emitStatus() {
    if (io) {
        io.emit('status', getStatus());
    }
}

function formatUptime(start) {
    if (!start) return '0s';
    const diff = Date.now() - start;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function getStatus() {
    return {
        online: isRunning && bot && bot.entity,
        username: bot ? bot.username : 'N/A',
        server: dataManager.getServerConfig(),
        isRunning: isRunning,
        uptime: isRunning && startTime ? formatUptime(startTime) : '0s',
        authStatus: authStatus
    };
}

function startBot() {
    if (isRunning) {
        logToConsole("Bot is already running.", 'warning');
        return;
    }

    shouldReconnect = true; // Enable reconnect on start
    authStatus = 'Pending';

    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    const config = dataManager.getServerConfig();
    const account = dataManager.getMinecraftAccount();

    if (!account.email) {
        logToConsole("No Minecraft account email set. Please configure it in settings.", 'error');
        authStatus = 'Offline';
        emitStatus();
        return;
    }

    const options = {
        host: config.ip,
        port: parseInt(config.port),
        version: config.version === 'auto' ? false : config.version,
        username: account.email,
        auth: 'microsoft',
        // Manage auth profiles to keep token cached
        profilesFolder: './data/nmp-cache',
        onMsaCode: (data) => {
            logToConsole(`Microsoft Auth Code: ${data.user_code}`, 'action');
            logToConsole(`Please visit ${data.verification_uri}`, 'action');
            authStatus = 'Pending Auth';
            emitStatus();
            if (io) {
                io.emit('auth-code', data);
            }
        }
    };

    logToConsole(`Connecting to ${options.host}:${options.port} as ${options.username}...`);

    try {
        bot = mineflayer.createBot(options);
        // Note: isRunning is true here to indicate process started, but not yet logged in.
        // We might want to wait for login to set isRunning?
        // But dashboard needs to know "Connecting".
        isRunning = true;
        startTime = null;
        emitStatus();

        bot.loadPlugin(pathfinder);
        bot.loadPlugin(autoEat);

        bindEvents();
    } catch (err) {
        logToConsole(`Failed to create bot: ${err.message}`, 'error');
        isRunning = false;
        shouldReconnect = false;
        authStatus = 'Offline';
        emitStatus();
    }
}

function stopBot() {
    if (!bot) return;

    logToConsole("Stopping bot...");
    shouldReconnect = false; // Disable reconnect on explicit stop

    // Stop AFK
    stopAfk();

    // Clear reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Quit
    try {
        bot.quit();
    } catch (e) {
        // ignore
    }

    bot = null;
    isRunning = false;
    startTime = null;
    authStatus = 'Offline';
    emitStatus();
    logToConsole("Bot stopped.");
}

function restartBot() {
    stopBot();
    setTimeout(startBot, 2000); // Wait a bit before restart
}

function bindEvents() {
    if (!bot) return;

    bot.on('login', () => {
        logToConsole(`Logged in as ${bot.username}`);
        isRunning = true;
        startTime = Date.now();
        authStatus = 'Verified';
        emitStatus();
    });

    bot.on('spawn', () => {
        logToConsole("Bot spawned.");
        emitStatus();
    });

    bot.on('end', (reason) => {
        logToConsole(`Bot disconnected: ${reason}`, 'warning');
        isRunning = false;
        bot = null;
        startTime = null;
        stopAfk();

        // Auto Reconnect
        const settings = dataManager.getSettings();
        if (shouldReconnect && settings.autoReconnect) {
            logToConsole("Auto-reconnecting in 10 seconds...");
            authStatus = 'Reconnecting';
            emitStatus();
            reconnectTimeout = setTimeout(startBot, 10000);
        } else {
            authStatus = 'Offline';
            emitStatus();
        }
    });

    bot.on('kicked', (reason) => {
        logToConsole(`Bot kicked: ${reason}`, 'error');
    });

    bot.on('error', (err) => {
        logToConsole(`Bot error: ${err.message}`, 'error');
    });

    bot.on('message', (jsonMsg) => {
        const message = jsonMsg.toString();
        if (io) {
            io.emit('log', { message: message, type: 'chat' });
        }
    });
}

// --- AFK Logic ---
function startAfk() {
    if (!bot || !bot.entity) return;
    logToConsole("Starting AFK mode...");

    if (afkInterval) clearInterval(afkInterval);

    afkInterval = setInterval(() => {
        if (!bot || !bot.entity) return;

        const yaw = Math.random() * Math.PI - (0.5 * Math.PI);
        const pitch = Math.random() * Math.PI - (0.5 * Math.PI);
        bot.look(yaw, pitch);

        if (Math.random() > 0.8) {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500);
        }

        bot.swingArm();

    }, 5000);
}

function stopAfk() {
    if (afkInterval) {
        clearInterval(afkInterval);
        afkInterval = null;
        logToConsole("AFK mode stopped.");
    }
}

function chat(message) {
    if (!bot) return;
    bot.chat(message);
    logToConsole(`> ${message}`, 'output');
}

module.exports = {
    setIo,
    startBot,
    stopBot,
    restartBot,
    getStatus,
    chat,
    startAfk,
    stopAfk
};
