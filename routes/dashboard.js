const express = require('express');
const router = express.Router();
const botController = require('../bot/bot');
const dataManager = require('../utils/dataManager');

router.get('/', (req, res) => {
    const status = botController.getStatus();
    res.render('dashboard', {
        page: 'home',
        status: status
    });
});

router.get('/server', (req, res) => {
    const server = dataManager.getServerConfig();
    const account = dataManager.getMinecraftAccount();
    const settings = dataManager.getSettings();
    res.render('server', {
        page: 'server',
        server,
        account,
        settings
    });
});

router.get('/console', (req, res) => {
    res.render('console', { page: 'console' });
});

module.exports = router;
