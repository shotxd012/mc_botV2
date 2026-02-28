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

router.get('/bot/:id', async (req, res) => {
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

    res.render('bot-control', {
        page: 'bot',
        status: status,
        botConfig: botConfig,
        botId: id,
        user: user
    });
});

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

// Admin Management Route
router.get('/admin', async (req, res) => {
    // Check if user has admin privileges
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.redirect('/');
    }
    
    const allUsers = await dataManager.getAllAdmins();
    const allBots = await dataManager.getBots();
    const allServers = await dataManager.getServers();
    const adminLogs = await dataManager.getAdminLogs(200);
    const botStatuses = botManager.getAllBotsStatus();
    const systemStats = buildSystemStats({
        bots: allBots,
        botStatuses,
        servers: allServers
    });
    
    res.render('admin', {
        page: 'admin',
        users: allUsers,
        bots: allBots,
        servers: allServers,
        logs: adminLogs,
        systemStats
    });
});

module.exports = router;
