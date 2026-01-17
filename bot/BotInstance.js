const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').plugin;
const dataManager = require('../utils/dataManager');

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
        this.authStatus = 'Offline'; // Offline, Pending, Verified

        // Bind methods to this
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.restart = this.restart.bind(this);
        this.getStatus = this.getStatus.bind(this);
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        // console.log(`[Bot ${this.id}] ${logEntry}`);
        if (this.io) {
            this.io.emit('log', { botId: this.id, message: logEntry, type });
        }
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

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    getStatus() {
        return {
            id: this.id,
            name: this.botConfig.name,
            online: this.isRunning && this.bot && this.bot.entity,
            username: this.bot ? this.bot.username : 'N/A',
            server: this.botConfig.server,
            isRunning: this.isRunning,
            uptime: this.isRunning && this.startTime ? this.formatUptime(this.startTime) : '0s',
            authStatus: this.authStatus
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
            this.startTime = null;
            this.emitStatus();

            this.bot.loadPlugin(pathfinder);
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

        this.bot.on('kicked', (reason) => {
            this.log(`Bot kicked: ${reason}`, 'error');
        });

        this.bot.on('error', (err) => {
            this.log(`Bot error: ${err.message}`, 'error');
        });

        this.bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            if (this.io) {
                this.io.emit('log', { botId: this.id, message: message, type: 'chat' });
            }
        });
    }

    // --- AFK Logic ---
    startAfk() {
        if (!this.bot || !this.bot.entity) return;
        this.log("Starting AFK mode...");

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
            this.log("AFK mode stopped.");
        }
    }

    chat(message) {
        if (!this.bot) return;
        this.bot.chat(message);
        this.log(`> ${message}`, 'output');
    }
}

module.exports = BotInstance;
