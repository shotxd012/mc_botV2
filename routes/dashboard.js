const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');

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

    res.render('bot-control', {
        page: 'bot',
        status: status,
        botConfig: botConfig,
        botId: id,
        user: user
    });
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
    
    res.render('admin', {
        page: 'admin',
        users: allUsers,
        bots: allBots
    });
});

module.exports = router;
