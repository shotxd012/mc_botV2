const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');

// Bot Control
router.post('/bot/:id/start', (req, res) => {
    botManager.startBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/stop', (req, res) => {
    botManager.stopBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/restart', (req, res) => {
    botManager.restartBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/afk', (req, res) => {
    const { enabled } = req.body;
    if (enabled) {
        botManager.startAfk(req.params.id);
    } else {
        botManager.stopAfk(req.params.id);
    }
    res.json({ success: true });
});

router.post('/bot/:id/command', (req, res) => {
    const { command } = req.body;
    if (command) {
        botManager.chat(req.params.id, command);
    }
    res.json({ success: true });
});

// Bot Management
router.post('/bots/create', (req, res) => {
    const newBot = botManager.createBot(req.body);
    res.json({ success: true, bot: newBot });
});

router.post('/bot/:id/delete', (req, res) => {
    const success = botManager.deleteBot(req.params.id);
    res.json({ success });
});

// Settings Updates
router.post('/bot/:id/settings', (req, res) => {
    const { server, account } = req.body;
    const updates = {};
    if (server) updates.server = server;
    if (account) updates.account = account;

    botManager.updateBotConfig(req.params.id, updates);
    res.json({ success: true });
});

// Global Settings
router.post('/settings/general', (req, res) => {
    const { autoReconnect } = req.body;
    dataManager.updateSettings({ autoReconnect: autoReconnect === true || autoReconnect === 'true' });
    res.json({ success: true });
});

module.exports = router;
