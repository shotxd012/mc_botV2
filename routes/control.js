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
    const bot = botManager.getBotInstance(req.params.id);
    
    if (!bot) {
        return res.json({ success: false, error: 'Bot not found' });
    }
    
    // If enabled is undefined or null, toggle the current state
    if (typeof enabled === 'undefined' || enabled === null) {
        if (bot.isAfkActive) {
            botManager.stopAfk(req.params.id);
        } else {
            botManager.startAfk(req.params.id);
        }
    } else {
        // Explicit enable/disable
        if (enabled) {
            botManager.startAfk(req.params.id);
        } else {
            botManager.stopAfk(req.params.id);
        }
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
    if (success) {
        res.json({ success: true, message: 'Bot deleted successfully.' });
    } else {
        res.json({ success: false, message: 'Failed to delete bot. Bot may not exist.' });
    }
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
router.post('/settings/general', async (req, res) => {
    const { autoReconnect } = req.body;
    await dataManager.updateSettings({ autoReconnect: autoReconnect === true || autoReconnect === 'true' });
    res.json({ success: true });
});

// Get console history
router.get('/bot/:id/history', (req, res) => {
    const { count } = req.query;
    const historyCount = parseInt(count) || 100;
    const history = botManager.getLogHistory(req.params.id, historyCount);
    res.json({ success: true, history });
});

// Clear console history
router.post('/bot/:id/history/clear', (req, res) => {
    const bot = botManager.getBotInstance(req.params.id);
    if (bot) {
        bot.clearConsoleHistory();
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Bot not found' });
    }
});

module.exports = router;
