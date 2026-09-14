const mineflayer = require('mineflayer');
const mineflayerPathfinder = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').loader;
const dataManager = require('../utils/dataManager');
const BotLog = require('../models/BotLog');

class BotInstance {
    constructor(id, botConfig, io) {
        this.id = id;
        this.botConfig = botConfig; // The specific bot data from data.json
        this.io = io;
        this.bot = null;

        this.isRunning = false;
        this.afkInterval = null;
        this.reconnectTimeout = null;
        this.shouldReconnect = false;
        this.startTime = null;
        this.uptimeInterval = null; // Interval for periodic uptime updates
        this.authStatus = 'Offline'; // Offline, Pending, Verified
        this.uptimeInterval = null; // Interval for periodic uptime updates
        this.isAfkActive = false; // Track AFK state
        
        // Console history
        this.consoleHistory = [];
        this.maxHistorySize = 1000; // Maximum number of log entries to keep in memory
        
        this.loadConsoleHistory();

        // Bind methods to this
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.restart = this.restart.bind(this);
        this.getStatus = this.getStatus.bind(this);
        this.getLogHistory = this.getLogHistory.bind(this);
        this.clearConsoleHistory = this.clearConsoleHistory.bind(this);
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        // console.log(`[Bot ${this.id}] ${logEntry}`);
        if (this.io) {
            this.io.emit('log', { botId: this.id, message: logEntry, type });
        }
        
        // Add to console history
        this.addLogToHistory(logEntry, type);
    }

    emitStatus() {
        if (this.io) {
            this.io.emit('status', { botId: this.id, status: this.getStatus() });
        }
    }

    formatUptime(start) {
        if (!start) return '0s';
        const diff = Date.now() - start;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    getStatus() {
        // Initialize default values
        let health = '-';
        let food = '-';
        let position = '-';
        let dimension = '-';
        
        // Get actual values if bot is available
        if (this.bot && this.bot.entity) {
            health = this.bot.health || 20;
            food = this.bot.food || 20;
            if (this.bot.entity.position) {
                position = `${Math.round(this.bot.entity.position.x)}, ${Math.round(this.bot.entity.position.y)}, ${Math.round(this.bot.entity.position.z)}`;
            }
            dimension = this.bot.game.dimension || 'overworld';
        }
        
        return {
            id: this.id,
            name: this.botConfig.name,
            online: this.isRunning && this.bot && this.bot.entity,
            username: this.bot ? this.bot.username : 'N/A',
            server: this.botConfig.server,
            isRunning: this.isRunning,
            uptime: this.isRunning && this.startTime ? this.formatUptime(this.startTime) : '0s',
            authStatus: this.authStatus,
            isAfkActive: this.isAfkActive,
            health: health,
            food: food,
            position: position,
            dimension: dimension
        };
    }

    updateConfig(newConfig) {
        this.botConfig = newConfig;
        this.emitStatus();
    }

    start() {
        if (this.isRunning) {
            this.log("Bot is already running.", 'warning');
            return;
        }

        this.shouldReconnect = true;
        this.authStatus = 'Pending';

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        const config = this.botConfig.server;
        const account = this.botConfig.account;

        if (!account.email) {
            this.log("No Minecraft account email set.", 'error');
            this.authStatus = 'Offline';
            this.emitStatus();
            return;
        }

        const options = {
            host: config.ip,
            port: parseInt(config.port),
            version: config.version === 'auto' ? false : config.version,
            username: account.email,
            auth: 'microsoft',
            profilesFolder: `./data/nmp-cache-${this.id}`, // Unique cache per bot
            onMsaCode: (data) => {
                this.log(`Microsoft Auth Code: ${data.user_code}`, 'action');
                this.log(`Please visit ${data.verification_uri}`, 'action');
                this.authStatus = 'Pending Auth';
                this.emitStatus();
                if (this.io) {
                    this.io.emit('auth-code', { botId: this.id, data });
                }
            }
        };

        this.log(`Connecting to ${options.host}:${options.port} as ${options.username}...`);

        try {
            this.bot = mineflayer.createBot(options);
            this.isRunning = true;
            // Don't reset startTime here, it will be set on login
            this.emitStatus();

            this.bot.loadPlugin(mineflayerPathfinder.pathfinder);
            this.bot.loadPlugin(autoEat);

            this.bindEvents();
        } catch (err) {
            this.log(`Failed to create bot: ${err.message}`, 'error');
            this.isRunning = false;
            this.shouldReconnect = false;
            this.authStatus = 'Offline';
            this.emitStatus();
        }
    }

    stop() {
        if (!this.bot) return;

        this.log("Stopping bot...");
        this.shouldReconnect = false;
        this.stopAfk();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        try {
            this.bot.quit();
        } catch (e) {
            // ignore
        }

        this.bot = null;
        this.isRunning = false;
        this.startTime = null;
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
        this.authStatus = 'Offline';
        this.emitStatus();
        this.log("Bot stopped.");
    }

    restart() {
        this.stop();
        setTimeout(this.start, 2000);
    }

    bindEvents() {
        if (!this.bot) return;

        this.bot.on('login', () => {
            this.log(`Logged in as ${this.bot.username}`);
            this.isRunning = true;
            this.startTime = Date.now();
            this.authStatus = 'Verified';
            this.emitStatus();
            
            // Start periodic uptime updates to console
            if (this.uptimeInterval) clearInterval(this.uptimeInterval);
            this.uptimeInterval = setInterval(() => {
                if (this.isRunning && this.startTime) {
                    this.log(`Uptime: ${this.formatUptime(this.startTime)}`, 'info');
                }
            }, 60000); // Update every minute

            // Update email in config if it changed/was auto-detected (unlikely but good practice)
            // Actually, we don't want to write to disk here unnecessarily.
        });

        this.bot.on('spawn', () => {
            this.log("Bot spawned.");
            this.emitStatus();
        });

        this.bot.on('end', (reason) => {
            this.log(`Bot disconnected: ${reason}`, 'warning');
            this.isRunning = false;
            this.bot = null;
            this.startTime = null;
            if (this.uptimeInterval) {
                clearInterval(this.uptimeInterval);
                this.uptimeInterval = null;
            }
            this.stopAfk();

            const settings = dataManager.getSettings();
            if (this.shouldReconnect && settings.autoReconnect) {
                this.log("Auto-reconnecting in 10 seconds...");
                this.authStatus = 'Reconnecting';
                this.emitStatus();
                this.reconnectTimeout = setTimeout(this.start, 10000);
            } else {
                this.authStatus = 'Offline';
                this.emitStatus();
            }
        });

        this.bot.on('kicked', (reason, loggedIn) => {
            // Recursively extract plain text from NBT compound/chat JSON structures.
            // Servers like BungeeCord/Velocity send reasons as NBT: { type, value } wrappers.
            const extractText = (node) => {
                if (node === null || node === undefined) return '';
                if (typeof node === 'string') return node;
                if (typeof node === 'number' || typeof node === 'boolean') return String(node);
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (typeof node === 'object') {
                    // NBT-style { type: 'string'|'compound'|'list', value: ... }
                    if ('type' in node && 'value' in node) {
                        if (node.type === 'list' && node.value && Array.isArray(node.value.value)) {
                            return node.value.value.map(extractText).join('');
                        }
                        return extractText(node.value);
                    }
                    // Standard Minecraft chat JSON { text, extra, ... }
                    let out = '';
                    if (node.text) out += extractText(node.text);
                    if (node.extra) out += extractText(node.extra);
                    // Collect any other nested compound fields
                    for (const key of Object.keys(node)) {
                        if (key !== 'text' && key !== 'extra' && typeof node[key] === 'object') {
                            out += extractText(node[key]);
                        }
                    }
                    return out || JSON.stringify(node);
                }
                return '';
            };

            let reasonText;
            if (typeof reason === 'string') {
                try {
                    reasonText = extractText(JSON.parse(reason));
                } catch {
                    reasonText = reason;
                }
            } else {
                reasonText = extractText(reason);
            }

            reasonText = reasonText.trim().replace(/\n+/g, ' | ') || 'Unknown reason';
            this.log(`Bot kicked: ${reasonText}`, 'error');
        });

        this.bot.on('error', (err) => {
            this.log(`Bot error: ${err.message}`, 'error');
        });

        // Raw message event (includes system messages, chat, etc.)
        this.bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            // Log to console
            this.log(`[MSG] ${message}`, 'chat');
            // Also emit to frontend
            if (this.io) {
                this.io.emit('log', { botId: this.id, message: `[MSG] ${message}`, type: 'chat' });
            }
        });
        
        // Player chat messages specifically
        this.bot.on('chat', (username, message) => {
            // Log player chat to console
            this.log(`[${username}] ${message}`, 'chat');
            // Also emit to frontend
            if (this.io) {
                this.io.emit('log', { botId: this.id, message: `[${username}] ${message}`, type: 'chat' });
            }
        });
        
        // Health update event
        this.bot.on('health', () => {
            this.emitStatus();
        });
        
        // Experience update event (food level changes trigger health event in newer versions, but we'll add this too)
        this.bot.on('entityMoved', (entity) => {
            // Only emit status update if it's the bot's own entity that moved
            if (this.bot && entity.id === this.bot.entity.id) {
                this.emitStatus();
            }
        });
        
        // Dimension change event
        this.bot.on('game', () => {
            this.emitStatus();
        });
    }

    // --- AFK Logic ---
    startAfk() {
        if (!this.bot || !this.bot.entity) return;
        this.log("Starting AFK mode...");
        this.isAfkActive = true;
        this.emitStatus(); // Emit status update so frontend knows AFK state changed

        if (this.afkInterval) clearInterval(this.afkInterval);

        this.afkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;

            const yaw = Math.random() * Math.PI - (0.5 * Math.PI);
            const pitch = Math.random() * Math.PI - (0.5 * Math.PI);
            this.bot.look(yaw, pitch);

            if (Math.random() > 0.8) {
                this.bot.setControlState('jump', true);
                setTimeout(() => this.bot.setControlState('jump', false), 500);
            }

            this.bot.swingArm();

        }, 5000);
    }

    stopAfk() {
        if (this.afkInterval) {
            clearInterval(this.afkInterval);
            this.afkInterval = null;
        }
        this.isAfkActive = false;
        this.log("AFK mode stopped.");
        this.emitStatus(); // Emit status update so frontend knows AFK state changed
    }

    chat(message) {
        if (!this.bot) return;
        this.bot.chat(message);
        this.log(`> ${message}`, 'output');
    }

    // --- Console History Methods ---
    async addLogToHistory(message, type = 'info') {
        const logEntry = {
            timestamp: new Date(),
            message,
            type,
            botId: this.id
        };

        this.consoleHistory.push({ ...logEntry, timestamp: logEntry.timestamp.toISOString() });

        // Limit history size
        if (this.consoleHistory.length > this.maxHistorySize) {
            this.consoleHistory = this.consoleHistory.slice(-this.maxHistorySize);
        }

        // Save to MongoDB asynchronously
        try {
            await BotLog.create(logEntry);
        } catch (err) {
            console.error(`Failed to save log to MongoDB for bot ${this.id}:`, err);
        }
    }

    getLogHistory(count = 100) {
        // Return the last 'count' entries, or all if count is greater than available
        const startIndex = Math.max(0, this.consoleHistory.length - count);
        return this.consoleHistory.slice(startIndex);
    }

    async loadConsoleHistory() {
        try {
            const logs = await BotLog.find({ botId: this.id })
                .sort({ timestamp: -1 })
                .limit(this.maxHistorySize)
                .lean();
            
            // Reverse so oldest is first
            this.consoleHistory = logs.reverse().map(log => ({
                timestamp: new Date(log.timestamp).toISOString(),
                message: log.message,
                type: log.type
            }));
        } catch (err) {
            console.error(`Failed to load console history from MongoDB for bot ${this.id}:`, err);
            this.consoleHistory = [];
        }
    }

    async clearConsoleHistory() {
        this.consoleHistory = [];
        try {
            await BotLog.deleteMany({ botId: this.id });
        } catch (err) {
            console.error(`Failed to clear console history in MongoDB for bot ${this.id}:`, err);
        }
    }
}

module.exports = BotInstance;
