const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');

router.get('/', (req, res) => {
    const bots = botManager.getAllBotsStatus();
    res.render('dashboard', {
        page: 'home',
        bots: bots
    });
});

router.get('/bot/:id', async (req, res) => {
    const id = req.params.id;
    const status = botManager.getStatus(id);

    if (!status) {
        return res.redirect('/');
    }

    const botConfig = await dataManager.getBot(id);

    res.render('bot-control', {
        page: 'bot',
        status: status,
        botConfig: botConfig,
        botId: id
    });
});

module.exports = router;
