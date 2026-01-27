const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');
const Admin = require('../models/Admin');

// Bot Control
router.post('/bot/:id/start', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    botManager.startBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/stop', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    botManager.stopBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/restart', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    botManager.restartBot(req.params.id);
    res.json({ success: true });
});

router.post('/bot/:id/afk', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    const { enabled } = req.body;
    const botInstance = botManager.getBotInstance(req.params.id);
    
    if (!botInstance) {
        return res.json({ success: false, error: 'Bot not found' });
    }
    
    // If enabled is undefined or null, toggle the current state
    if (typeof enabled === 'undefined' || enabled === null) {
        if (botInstance.isAfkActive) {
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

router.post('/bot/:id/command', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    const { command } = req.body;
    if (command) {
        botManager.chat(req.params.id, command);
    }
    res.json({ success: true });
});

// Bot Management
router.post('/bots/create', async (req, res) => {
    // Check if user has admin privileges
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can create bots.' });
    }
    
    const newBot = botManager.createBot(req.body);
    res.json({ success: true, bot: newBot });
});

router.post('/bot/:id/delete', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    const success = botManager.deleteBot(req.params.id);
    if (success) {
        res.json({ success: true, message: 'Bot deleted successfully.' });
    } else {
        res.json({ success: false, message: 'Failed to delete bot. Bot may not exist.' });
    }
});

// Settings Updates
router.post('/bot/:id/settings', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    const { server, account } = req.body;
    const updates = {};
    if (server) updates.server = server;
    if (account) updates.account = account;

    botManager.updateBotConfig(req.params.id, updates);
    res.json({ success: true });
});

// Global Settings
router.post('/settings/general', async (req, res) => {
    // Check if user has admin privileges
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can update global settings.' });
    }
    
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
router.post('/bot/:id/history/clear', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    
    const botInstance = botManager.getBotInstance(req.params.id);
    if (botInstance) {
        botInstance.clearConsoleHistory();
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Bot not found' });
    }
});

// Admin Management Routes
router.post('/admin/promote', async (req, res) => {
    // Check if user has admin privileges
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can promote users.' });
    }
    
    const { username } = req.body;
    
    try {
        // Update user role to admin
        const result = await Admin.updateOne({ username }, { role: 'admin' });
        if (result.modifiedCount > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        console.error('Error promoting user:', err);
        res.json({ success: false, error: 'Failed to promote user' });
    }
});

router.post('/admin/demote', async (req, res) => {
    // Check if user has admin privileges
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can demote users.' });
    }
    
    const { username } = req.body;
    
    try {
        // Update user role to user
        const result = await Admin.updateOne({ username }, { role: 'user' });
        if (result.modifiedCount > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        console.error('Error demoting user:', err);
        res.json({ success: false, error: 'Failed to demote user' });
    }
});

// Bot Assignment Routes
router.post('/admin/assign-bot', async (req, res) => {
    // Check if user has admin privileges
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can assign bots.' });
    }
    
    const { botId, username } = req.body;
    
    try {
        const success = await dataManager.assignBotToUser(botId, username);
        if (success) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Bot not found or assignment failed' });
        }
    } catch (err) {
        console.error('Error assigning bot to user:', err);
        res.json({ success: false, error: 'Failed to assign bot to user' });
    }
});

router.post('/admin/unassign-bot', async (req, res) => {
    // Check if user has admin privileges
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can unassign bots.' });
    }
    
    const { botId } = req.body;
    
    try {
        const success = await dataManager.unassignBot(botId);
        if (success) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Bot not found or unassignment failed' });
        }
    } catch (err) {
        console.error('Error unassigning bot:', err);
        res.json({ success: false, error: 'Failed to unassign bot' });
    }
});

module.exports = router;
