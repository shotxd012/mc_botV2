const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const mongoose = require('mongoose');

function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

function execFileAsync(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
        });
    });
}

function readFileSafe(path) {
    try {
        return fs.readFileSync(path, 'utf8');
    } catch (err) {
        return null;
    }
}

function parseDiskUsage(output) {
    const lines = output.trim().split('\n');
    if (lines.length < 2) return null;
    const row = lines[1].split(/\s+/);
    if (row.length < 6) return null;
    const total = parseInt(row[1], 10) * 1024;
    const used = parseInt(row[2], 10) * 1024;
    const available = parseInt(row[3], 10) * 1024;
    const percent = row[4];
    return {
        total: formatBytes(total),
        used: formatBytes(used),
        free: formatBytes(available),
        percent
    };
}

function parseNetworkStats() {
    const data = readFileSafe('/proc/net/dev');
    if (!data) return null;
    const lines = data.trim().split('\n').slice(2);
    let rx = 0;
    let tx = 0;
    lines.forEach((line) => {
        const [iface, rest] = line.split(':');
        if (!iface || !rest) return;
        const name = iface.trim();
        if (name === 'lo') return;
        const parts = rest.trim().split(/\s+/);
        if (parts.length < 9) return;
        rx += parseInt(parts[0], 10);
        tx += parseInt(parts[8], 10);
    });
    return {
        rx: formatBytes(rx),
        tx: formatBytes(tx)
    };
}

function readTemperature() {
    try {
        const zones = fs.readdirSync('/sys/class/thermal').filter((entry) => entry.startsWith('thermal_zone'));
        for (const zone of zones) {
            const tempRaw = readFileSafe(`/sys/class/thermal/${zone}/temp`);
            if (!tempRaw) continue;
            const value = parseInt(tempRaw.trim(), 10);
            if (Number.isFinite(value) && value > 0) {
                return `${(value / 1000).toFixed(1)}°C`;
            }
        }
    } catch (err) {
        return null;
    }
    return null;
}

let lastCpuSnapshot = null;
let loadHistory = [];
const lastSeenByBot = new Map();

function computeProcessCpuPercent() {
    const now = process.hrtime.bigint();
    const usage = process.cpuUsage();
    if (!lastCpuSnapshot) {
        lastCpuSnapshot = { time: now, usage };
        return 0;
    }
    const elapsedNs = Number(now - lastCpuSnapshot.time);
    const elapsedUs = elapsedNs / 1000;
    const deltaUser = usage.user - lastCpuSnapshot.usage.user;
    const deltaSystem = usage.system - lastCpuSnapshot.usage.system;
    const cpuTimeUs = deltaUser + deltaSystem;
    lastCpuSnapshot = { time: now, usage };
    if (elapsedUs <= 0) return 0;
    const cores = os.cpus()?.length || 1;
    return Math.min(100, (cpuTimeUs / (elapsedUs * cores)) * 100);
}

function updateLoadHistory(loadAvg) {
    const entry = {
        ts: new Date().toISOString(),
        load1: Number(loadAvg[0] || 0).toFixed(2),
        load5: Number(loadAvg[1] || 0).toFixed(2),
        load15: Number(loadAvg[2] || 0).toFixed(2)
    };
    loadHistory.push(entry);
    if (loadHistory.length > 20) {
        loadHistory = loadHistory.slice(loadHistory.length - 20);
    }
    return loadHistory;
}

async function getDbStatus() {
    const state = mongoose.connection?.readyState ?? 0;
    let pingMs = null;
    if (state === 1 && mongoose.connection?.db) {
        const start = Date.now();
        try {
            await mongoose.connection.db.admin().ping();
            pingMs = Date.now() - start;
        } catch (err) {
            pingMs = null;
        }
    }
    return {
        readyState: state,
        readyLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown',
        pingMs
    };
}

async function buildSystemStats({ bots = [], botStatuses = [], servers = [] } = {}) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpuCount = os.cpus()?.length || 0;
    const loadAvg = os.loadavg ? os.loadavg() : [0, 0, 0];
    const cpuPercent = computeProcessCpuPercent();

    const statusMap = new Map();
    botStatuses.forEach((status) => {
        statusMap.set(parseInt(status.id, 10), status);
    });

    const onlineBots = botStatuses.filter((status) => status && status.online).length;
    const totalBots = botStatuses.length;

    const serverStats = new Map();
    bots.forEach((bot) => {
        if (!bot.serverProfile) return;
        const key = String(bot.serverProfile);
        if (!serverStats.has(key)) {
            serverStats.set(key, { hasBot: false, hasOnline: false });
        }
        const entry = serverStats.get(key);
        entry.hasBot = true;
        const status = statusMap.get(parseInt(bot.id, 10));
        if (status && status.online) {
            entry.hasOnline = true;
        }
    });

    const serversWithBots = Array.from(serverStats.values()).filter((entry) => entry.hasBot).length;
    const serversOnline = Array.from(serverStats.values()).filter((entry) => entry.hasOnline).length;
    const serversOffline = Math.max(0, serversWithBots - serversOnline);

    botStatuses.forEach((status) => {
        if (status && status.online) {
            lastSeenByBot.set(parseInt(status.id, 10), new Date());
        }
    });

    const botStatusList = botStatuses.map((status) => {
        const lastSeen = lastSeenByBot.get(parseInt(status.id, 10));
        return {
            id: status.id,
            name: status.name,
            online: status.online,
            afk: status.isAfkActive,
            uptime: status.uptime,
            lastSeen: lastSeen ? lastSeen.toLocaleString() : 'Unknown'
        };
    });

    let disk = null;
    try {
        const output = await execFileAsync('df', ['-k', '/']);
        disk = parseDiskUsage(output);
    } catch (err) {
        disk = null;
    }

    const network = parseNetworkStats();
    const temperature = readTemperature();
    const db = await getDbStatus();
    const history = updateLoadHistory(loadAvg);

    return {
        memory: {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem),
            process: {
                rss: formatBytes(memUsage.rss),
                heapUsed: formatBytes(memUsage.heapUsed),
                heapTotal: formatBytes(memUsage.heapTotal)
            }
        },
        cpu: {
            count: cpuCount,
            loadAvg: loadAvg.map((value) => value.toFixed(2)).join(' / '),
            processPercent: cpuPercent.toFixed(1)
        },
        uptime: {
            system: formatDuration(os.uptime()),
            app: formatDuration(process.uptime())
        },
        bots: {
            total: totalBots,
            online: onlineBots,
            offline: Math.max(0, totalBots - onlineBots)
        },
        servers: {
            total: servers.length,
            assigned: serversWithBots,
            online: serversOnline,
            offline: serversOffline
        },
        disk,
        network,
        temperature: temperature || 'N/A',
        db,
        botsDetail: botStatusList,
        loadHistory: history,
        meta: {
            node: process.version,
            platform: `${os.platform()} ${os.release()}`,
            hostname: os.hostname(),
            arch: os.arch(),
            pid: process.pid
        }
    };
}

module.exports = {
    buildSystemStats
};
