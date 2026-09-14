const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const { getMongoURI } = require('../utils/database');
const mongoose = require('mongoose');
const os = require('os');

/**
 * GET /health
 * Public health check endpoint for monitoring tools
 */
router.get('/', async (req, res) => {
    const botStatuses = botManager.getAllBotsStatus();
    const onlineBots = botStatuses.filter(b => b.online).length;

    const dbState = mongoose.connection?.readyState ?? 0;
    const dbLabels = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const formatBytes = (b) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let v = b, u = 0;
        while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
        return `${v.toFixed(1)} ${units[u]}`;
    };

    res.json({
        status: dbState === 1 ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: {
            app: Math.floor(process.uptime()),
            system: Math.floor(os.uptime())
        },
        db: {
            state: dbLabels[dbState] || 'unknown',
            ready: dbState === 1
        },
        bots: {
            total: botStatuses.length,
            online: onlineBots,
            offline: botStatuses.length - onlineBots
        },
        memory: {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem),
            process_rss: formatBytes(process.memoryUsage().rss)
        },
        node: process.version,
        platform: `${os.platform()} ${os.arch()}`
    });
});

module.exports = router;
