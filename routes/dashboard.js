const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');
const passkeyUtils = require('../utils/passkey');
const { buildSystemStats } = require('../utils/systemStats');

router.get('/', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    let bots;
    
    if (user.role === 'admin') {
        // Admin sees all bots
        bots = botManager.getAllBotsStatus();
    } else {
        // Regular user sees only assigned bots
        const assignedBots = await dataManager.getBotsByUser(req.session.user.username);
        // Get status for only assigned bots
        bots = assignedBots.map(bot => botManager.getStatus(bot.id)).filter(status => status !== null);
    }
    
    res.render('dashboard', {
        page: 'home',
        user: user, // Pass user info to template for conditional rendering
        bots: bots
    });
});

async function renderBotPage(req, res, section = 'console', view = 'bot-control') {
    const id = req.params.id;
    const user = await dataManager.getAdmin(req.session.user.username);
    const status = botManager.getStatus(id);

    if (!status) {
        return res.redirect('/');
    }

    const botConfig = await dataManager.getBot(id);

    // Check if user has permission to access this bot
    if (user.role !== 'admin' && botConfig.assignedTo !== req.session.user.username) {
        return res.redirect('/');
    }

    if (passkeyUtils.requiresPasskeyForBot(botConfig) && !passkeyUtils.isPasskeyValidated(req, botConfig.id)) {
        return res.render('bot-passkey', {
            page: 'bot-passkey',
            user: user,
            botConfig: botConfig,
            botId: id,
            serverName: null,
            error: null
        });
    }

    res.render(view, {
        page: 'bot',
        status: status,
        botConfig: botConfig,
        botId: id,
        user: user,
        section: section
    });
}

router.get('/bot/:id', async (req, res) => renderBotPage(req, res));
router.get('/bot/:id/config', async (req, res) => renderBotPage(req, res, 'config'));
router.get('/bot/:id/analytics', async (req, res) => renderBotPage(req, res, 'analytics'));
router.get('/bot/:id/events', async (req, res) => renderBotPage(req, res, 'events'));
router.get('/bot/:id/game', async (req, res) => renderBotPage(req, res, 'game', 'bot-game'));
router.get('/bot/:id/settings', async (req, res) => renderBotPage(req, res, 'settings', 'bot-settings'));

router.post('/bot/:id/passkey', async (req, res) => {
    const id = req.params.id;
    const user = await dataManager.getAdmin(req.session.user.username);
    const botConfig = await dataManager.getBot(id);

    if (!botConfig) {
        return res.redirect('/');
    }

    // Check if user has permission to access this bot
    if (user.role !== 'admin' && botConfig.assignedTo !== req.session.user.username) {
        return res.redirect('/');
    }

    if (!passkeyUtils.requiresPasskeyForBot(botConfig)) {
        return res.redirect(`/bot/${id}`);
    }

    const { passkey } = req.body;
    if (passkeyUtils.isPasskeyValidForBot(botConfig, passkey)) {
        passkeyUtils.markPasskeyValidated(req, botConfig.id);
        return res.redirect(`/bot/${id}`);
    }

    return res.render('bot-passkey', {
        page: 'bot-passkey',
        user: user,
        botConfig: botConfig,
        botId: id,
        serverName: null,
        error: 'Invalid passkey.'
    });
});

router.post('/bot/:id/passkey/lock', async (req, res) => {
    const id = req.params.id;
    const user = await dataManager.getAdmin(req.session.user.username);
    const botConfig = await dataManager.getBot(id);

    if (!botConfig) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    if (user.role !== 'admin' && botConfig.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }

    passkeyUtils.clearPasskeyValidated(req, botConfig.id);
    res.json({ success: true });
});

// Profile Route
router.get('/profile', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (!user) {
        return res.redirect('/login');
    }
    
    // Get assigned bots for regular users
    let assignedBots = [];
    if (user.role === 'user') {
        assignedBots = await dataManager.getBotsByUser(req.session.user.username);
    }
    
    res.render('profile', {
        page: 'profile',
        user: {
            username: user.username,
            role: user.role || 'user', // Default to 'user' if role is undefined
            createdAt: user.createdAt
        },
        assignedBots: assignedBots,
        isAdmin: user.role === 'admin'
    });
});

// Admin Management Route (redirect to new modular admin router)
router.get('/admin', (req, res) => {
    res.redirect('/admin/overview');
});

// Multi-Console Grid Route
router.get('/console', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    let bots;

    if (user.role === 'admin') {
        bots = botManager.getAllBotsStatus();
    } else {
        const assignedBots = await dataManager.getBotsByUser(req.session.user.username);
        bots = assignedBots.map(bot => botManager.getStatus(bot.id)).filter(Boolean);
    }

    res.render('console-grid', {
        page: 'console',
        user,
        bots
    });
});

// Templates Route
router.get('/templates', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (!user) {
        return res.redirect('/login');
    }
    if (user.role !== 'admin') {
        return res.redirect('/');
    }
    const templates = await botManager.getTemplates();
    const allBots = await dataManager.getBots();

    res.render('templates', {
        page: 'templates',
        user,
        templates,
        bots: allBots
    });
});

module.exports = router;

