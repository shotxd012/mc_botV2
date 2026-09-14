const mineflayer = require('mineflayer');
const mineflayerPathfinder = require('mineflayer-pathfinder');
const autoEatLoader = require('mineflayer-auto-eat').loader;
const dataManager = require('../utils/dataManager');
const BotLog = require('../models/BotLog');
const BotEvent = require('../models/BotEvent');
const BotMetric = require('../models/BotMetric');
const Bot = require('../models/Bot');
const https = require('https');
const http = require('http');

let runtimeSnapshot = null;
let runtimeSnapshotAt = 0;

function getRuntimeMetrics() {
    const now = Date.now();
    if (!runtimeSnapshot || now - runtimeSnapshotAt >= 5000) {
        const currentUsage = process.cpuUsage();
        const currentTime = process.hrtime.bigint();
        let cpu = 0;

        if (runtimeSnapshot) {
            const elapsedMicroseconds = Number(currentTime - runtimeSnapshot.time) / 1000;
            const cpuMicroseconds = (currentUsage.user - runtimeSnapshot.usage.user) +
                (currentUsage.system - runtimeSnapshot.usage.system);
            const coreCount = require('os').cpus()?.length || 1;
            cpu = elapsedMicroseconds > 0
                ? Math.min(100, (cpuMicroseconds / (elapsedMicroseconds * coreCount)) * 100)
                : 0;
        }

        runtimeSnapshot = { time: currentTime, usage: currentUsage };
        runtimeSnapshotAt = now;
        getRuntimeMetrics.cached = {
            cpu: Number(cpu.toFixed(2)),
            memory: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
        };
    }

    return getRuntimeMetrics.cached;
}

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
        this.isAfkActive = false; // Track AFK state
        this.metricInterval = null; // Health/food sampling interval

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
        let health = '-';
        let food = '-';
        let position = '-';
        let dimension = '-';

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
            afkProfile: this.botConfig.afkProfile || 'random_look',
            autoEat: this.botConfig.autoEat !== false,
            autoStart: this.botConfig.autoStart === true,
            health: health,
            food: food,
            position: position,
            dimension: dimension,
            notes: this.botConfig.notes || '',
            totalUptime: this.botConfig.totalUptime || 0
        };
    }

    updateConfig(newConfig) {
        this.botConfig = newConfig;
        this.emitStatus();
    }

    // --- Webhook Alerts ---
    sendWebhook(eventType, details = '') {
        const url = this.botConfig.webhookUrl;
        if (!url || url.trim() === '') return;

        const embed = {
            embeds: [{
                title: `🤖 Bot Alert: ${this.botConfig.name}`,
                color: eventType === 'kicked' ? 0xef4444 : eventType === 'login' ? 0x10b981 : 0xf59e0b,
                fields: [
                    { name: 'Event', value: eventType.toUpperCase(), inline: true },
                    { name: 'Bot', value: this.botConfig.name, inline: true },
                    { name: 'Server', value: `${this.botConfig.server?.ip}:${this.botConfig.server?.port}`, inline: true },
                ],
                description: details || '',
                timestamp: new Date().toISOString(),
                footer: { text: 'MC Bot Dashboard' }
            }]
        };

        try {
            const payload = JSON.stringify(embed);
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const lib = isHttps ? https : http;

            const req = lib.request({
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                // Consume response to prevent socket hang
                res.resume();
            });

            req.on('error', (err) => {
                console.error(`[Bot ${this.id}] Webhook error: ${err.message}`);
            });

            req.write(payload);
            req.end();
        } catch (err) {
            console.error(`[Bot ${this.id}] Failed to send webhook: ${err.message}`);
        }
    }

    // --- Event Logging ---
    async logEvent(event, details = '') {
        try {
            await BotEvent.create({ botId: this.id, event, details });
            // Emit to frontend for live timeline
            if (this.io) {
                this.io.emit('bot-event', {
                    botId: this.id,
                    event,
                    details,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error(`[Bot ${this.id}] Failed to log event: ${err.message}`);
        }
    }

    // --- Metric Sampling ---
    startMetricSampling() {
        if (this.metricInterval) clearInterval(this.metricInterval);
        const sampleMetric = async () => {
            if (!this.bot || !this.bot.entity) return;
            try {
                const runtime = getRuntimeMetrics();
                await BotMetric.create({
                    botId: this.id,
                    health: Math.round(this.bot.health || 0),
                    food: Math.round(this.bot.food || 0),
                    cpu: runtime.cpu,
                    memory: runtime.memory
                });
            } catch (err) {
                // silently fail metric saves
            }
        };

        sampleMetric();
        this.metricInterval = setInterval(sampleMetric, 60000); // sample every 60 seconds
    }

    stopMetricSampling() {
        if (this.metricInterval) {
            clearInterval(this.metricInterval);
            this.metricInterval = null;
        }
    }

    // --- Total Uptime Accumulation ---
    async accumulateUptime() {
        if (!this.startTime) return;
        const sessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        if (sessionSeconds <= 0) return;
        try {
            await Bot.updateOne({ id: this.id }, { $inc: { totalUptime: sessionSeconds } });
            // Update local config cache too
            if (this.botConfig) {
                this.botConfig.totalUptime = (this.botConfig.totalUptime || 0) + sessionSeconds;
            }
        } catch (err) {
            console.error(`[Bot ${this.id}] Failed to accumulate uptime: ${err.message}`);
        }
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
            profilesFolder: `./data/nmp-cache-${this.id}`,
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
            this.emitStatus();

            this.bot.loadPlugin(mineflayerPathfinder.pathfinder);

            // Conditionally load auto-eat based on botConfig
            if (this.botConfig.autoEat !== false) {
                this.bot.loadPlugin(autoEatLoader);
                this.bot.once('autoEat:options', () => {
                    try {
                        this.bot.autoEat.options = {
                            priority: 'foodPoints',
                            startAt: 14,
                            bannedFood: []
                        };
                    } catch (e) { /* ignore */ }
                });
            }

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
        this.stopMetricSampling();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Accumulate uptime before stopping
        this.accumulateUptime();

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
            this.logEvent('login', `Logged in as ${this.bot.username}`);
            this.sendWebhook('login', `Bot connected to ${this.botConfig.server?.ip}`);
            this.startMetricSampling();

            // Periodic uptime log
            if (this.uptimeInterval) clearInterval(this.uptimeInterval);
            this.uptimeInterval = setInterval(() => {
                if (this.isRunning && this.startTime) {
                    this.log(`Uptime: ${this.formatUptime(this.startTime)}`, 'info');
                }
            }, 60000);
        });

        this.bot.on('spawn', () => {
            this.log("Bot spawned.");
            this.emitStatus();
            this.logEvent('spawn', 'Bot entity spawned in world');

            // Execute login commands sequentially
            const cmds = this.botConfig.loginCommands || [];
            if (cmds.length > 0) {
                this.log(`Executing ${cmds.length} login command(s)...`, 'action');
                cmds.forEach((cmd, i) => {
                    setTimeout(() => {
                        if (this.bot) {
                            this.bot.chat(cmd);
                            this.log(`[Login Cmd] ${cmd}`, 'output');
                        }
                    }, (i + 1) * 1500); // 1.5s delay between each command
                });
            }
        });

        this.bot.on('end', (reason) => {
            this.log(`Bot disconnected: ${reason}`, 'warning');
            const wasRunning = this.isRunning;
            this.isRunning = false;
            this.bot = null;
            this.startTime = null;
            if (this.uptimeInterval) {
                clearInterval(this.uptimeInterval);
                this.uptimeInterval = null;
            }
            this.stopAfk();
            this.stopMetricSampling();

            // Accumulate uptime
            if (wasRunning) this.accumulateUptime();

            this.logEvent('disconnect', `Disconnected: ${reason}`);
            this.sendWebhook('disconnect', `Bot disconnected: ${reason}`);

            const settings = dataManager.getSettings();
            if (this.shouldReconnect && settings.autoReconnect) {
                this.log("Auto-reconnecting in 10 seconds...");
                this.authStatus = 'Reconnecting';
                this.emitStatus();
                this.logEvent('reconnect', 'Scheduled auto-reconnect in 10s');
                this.reconnectTimeout = setTimeout(this.start, 10000);
            } else {
                this.authStatus = 'Offline';
                this.emitStatus();
            }
        });

        this.bot.on('kicked', (reason, loggedIn) => {
            const extractText = (node) => {
                if (node === null || node === undefined) return '';
                if (typeof node === 'string') return node;
                if (typeof node === 'number' || typeof node === 'boolean') return String(node);
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (typeof node === 'object') {
                    if ('type' in node && 'value' in node) {
                        if (node.type === 'list' && node.value && Array.isArray(node.value.value)) {
                            return node.value.value.map(extractText).join('');
                        }
                        return extractText(node.value);
                    }
                    let out = '';
                    if (node.text) out += extractText(node.text);
                    if (node.extra) out += extractText(node.extra);
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
            this.logEvent('kicked', reasonText);
            this.sendWebhook('kicked', `Kicked: ${reasonText}`);
        });

        this.bot.on('error', (err) => {
            this.log(`Bot error: ${err.message}`, 'error');
            this.logEvent('error', err.message);
        });

        // Raw message event
        this.bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            this.log(`[MSG] ${message}`, 'chat');
            if (this.io) {
                this.io.emit('log', { botId: this.id, message: `[MSG] ${message}`, type: 'chat' });
            }
        });

        // Player chat messages
        this.bot.on('chat', (username, message) => {
            this.log(`[${username}] ${message}`, 'chat');
            if (this.io) {
                this.io.emit('log', { botId: this.id, message: `[${username}] ${message}`, type: 'chat' });
            }
        });

        // Health update
        this.bot.on('health', () => {
            this.emitStatus();
        });

        // Entity movement
        this.bot.on('entityMoved', (entity) => {
            if (this.bot && entity.id === this.bot.entity.id) {
                this.emitStatus();
            }
        });

        // Dimension change
        this.bot.on('game', () => {
            this.emitStatus();
        });
    }

    // --- AFK Logic (Profile-based strategy) ---
    startAfk() {
        if (!this.bot || !this.bot.entity) return;
        const profile = this.botConfig.afkProfile || 'random_look';
        this.log(`Starting AFK mode [${profile}]...`);
        this.isAfkActive = true;
        this.emitStatus();
        this.logEvent('afk_start', `AFK profile: ${profile}`);

        if (this.afkInterval) clearInterval(this.afkInterval);

        switch (profile) {
            case 'spin':
                this._startAfkSpin();
                break;
            case 'jump_spam':
                this._startAfkJumpSpam();
                break;
            case 'circle_walk':
                this._startAfkCircleWalk();
                break;
            case 'random_look':
            default:
                this._startAfkRandomLook();
                break;
        }
    }

    _startAfkRandomLook() {
        this.afkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            const yaw = Math.random() * Math.PI * 2 - Math.PI;
            const pitch = (Math.random() - 0.5) * Math.PI;
            this.bot.look(yaw, pitch);
            if (Math.random() > 0.8) {
                this.bot.setControlState('jump', true);
                setTimeout(() => { if (this.bot) this.bot.setControlState('jump', false); }, 500);
            }
            this.bot.swingArm();
        }, 5000);
    }

    _startAfkSpin() {
        let yaw = 0;
        this.afkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            yaw += Math.PI / 8; // rotate 22.5 degrees each tick
            if (yaw > Math.PI) yaw -= Math.PI * 2;
            this.bot.look(yaw, 0);
        }, 500);
    }

    _startAfkJumpSpam() {
        this.afkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            this.bot.setControlState('jump', true);
            setTimeout(() => { if (this.bot) this.bot.setControlState('jump', false); }, 300);
            this.bot.swingArm();
        }, 2000);
    }

    _startAfkCircleWalk() {
        const { pathfinder, goals } = mineflayerPathfinder;
        let angle = 0;
        const radius = 3;
        this.afkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            try {
                angle += Math.PI / 8;
                if (angle > Math.PI * 2) angle = 0;
                const origin = this.bot.entity.position;
                const tx = Math.round(origin.x + Math.cos(angle) * radius);
                const tz = Math.round(origin.z + Math.sin(angle) * radius);
                const ty = Math.round(origin.y);
                this.bot.pathfinder.setGoal(new goals.GoalXZ(tx, tz), true);
            } catch (e) { /* pathfinder may not be ready */ }
        }, 4000);
    }

    stopAfk() {
        if (this.afkInterval) {
            clearInterval(this.afkInterval);
            this.afkInterval = null;
        }
        // Stop any movement
        if (this.bot) {
            try {
                this.bot.setControlState('forward', false);
                this.bot.setControlState('back', false);
                this.bot.setControlState('jump', false);
                if (this.bot.pathfinder) this.bot.pathfinder.stop();
            } catch (e) { /* ignore */ }
        }
        if (this.isAfkActive) {
            this.isAfkActive = false;
            this.log("AFK mode stopped.");
            this.emitStatus();
            this.logEvent('afk_stop', 'AFK mode deactivated');
        }
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

        if (this.consoleHistory.length > this.maxHistorySize) {
            this.consoleHistory = this.consoleHistory.slice(-this.maxHistorySize);
        }

        try {
            await BotLog.create(logEntry);
        } catch (err) {
            console.error(`Failed to save log to MongoDB for bot ${this.id}:`, err);
        }
    }

    getLogHistory(count = 100) {
        const startIndex = Math.max(0, this.consoleHistory.length - count);
        return this.consoleHistory.slice(startIndex);
    }

    async loadConsoleHistory() {
        try {
            const logs = await BotLog.find({ botId: this.id })
                .sort({ timestamp: -1 })
                .limit(this.maxHistorySize)
                .lean();

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
