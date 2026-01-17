const express = require('express');
const router = express.Router();
const botController = require('../bot/bot');
const dataManager = require('../utils/dataManager');

router.post('/start', (req, res) => {
    botController.startBot();
    res.json({ success: true, message: 'Bot starting...' });
});

router.post('/stop', (req, res) => {
    botController.stopBot();
    res.json({ success: true, message: 'Bot stopping...' });
});

router.post('/restart', (req, res) => {
    botController.restartBot();
    res.json({ success: true, message: 'Bot restarting...' });
});

router.post('/afk', (req, res) => {
    const { enabled } = req.body;
    if (enabled) {
        botController.startAfk();
    } else {
        botController.stopAfk();
    }
    res.json({ success: true });
});

router.post('/command', (req, res) => {
    const { command } = req.body;
    if (command) {
        botController.chat(command);
    }
    res.json({ success: true });
});

router.post('/settings/server', (req, res) => {
    const { ip, port, version } = req.body;
    dataManager.updateServerConfig({ ip, port: parseInt(port), version });
    res.json({ success: true });
});

router.post('/settings/account', (req, res) => {
    const { email } = req.body;
    dataManager.updateMinecraftAccount({ email });
    res.json({ success: true });
});

router.post('/settings/general', (req, res) => {
    const { autoReconnect } = req.body;
    dataManager.updateSettings({ autoReconnect: autoReconnect === true || autoReconnect === 'true' });
    res.json({ success: true });
});

module.exports = router;
