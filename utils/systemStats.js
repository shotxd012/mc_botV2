const os = require('os');

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

function buildSystemStats({ bots = [], botStatuses = [], servers = [] } = {}) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpuCount = os.cpus()?.length || 0;
    const loadAvg = os.loadavg ? os.loadavg() : [0, 0, 0];

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

    return {
        memory: {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem),
            process: {
                rss: formatBytes(memUsage.rss),
                heapUsed: formatBytes(memUsage.heapUsed)
            }
        },
        cpu: {
            count: cpuCount,
            loadAvg: loadAvg.map((value) => value.toFixed(2)).join(' / ')
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
        meta: {
            node: process.version,
            platform: `${os.platform()} ${os.release()}`,
            pid: process.pid
        }
    };
}

module.exports = {
    buildSystemStats
};
