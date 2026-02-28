const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');
const Admin = require('../models/Admin');
const passkeyUtils = require('../utils/passkey');

async function enforcePasskey(req, res, bot) {
    if (!passkeyUtils.requiresPasskeyForBot(bot)) {
        return null;
    }
    if (passkeyUtils.isPasskeyValidated(req, bot.id)) {
        return null;
    }
    res.status(403).json({
        success: false,
        error: 'Passkey required for this bot.',
        message: 'Passkey required for this bot.'
    });
    return { blocked: true };
}

// Bot Control
router.post('/bot/:id/start', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
    
    const newBot = await botManager.createBot(req.body);
    if (!newBot) {
        return res.json({ success: false, error: 'Failed to create bot.' });
    }
    await dataManager.addAdminLog(req.session.user.username, 'create_bot', String(newBot.id), {
        name: newBot.name,
        server: newBot.server
    });
    res.json({ success: true, bot: newBot });
});

router.post('/bot/:id/delete', async (req, res) => {
    // Check if user has admin privileges or is assigned to this bot
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not have access to this bot.' });
    }
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
    const success = botManager.deleteBot(req.params.id);
    if (success) {
        await dataManager.addAdminLog(req.session.user.username, 'delete_bot', String(req.params.id), null);
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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
    const { server, account } = req.body;
    const updates = {};
    if (server) updates.server = server;
    if (account) updates.account = account;

    botManager.updateBotConfig(req.params.id, updates);
    await dataManager.addAdminLog(req.session.user.username, 'update_bot_settings', String(req.params.id), updates);
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
    await dataManager.addAdminLog(req.session.user.username, 'update_global_settings', 'autoReconnect', {
        value: autoReconnect === true || autoReconnect === 'true'
    });
    res.json({ success: true });
});

// Get console history
router.get('/bot/:id/history', async (req, res) => {
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) {
        return res.json({ success: false, error: 'Bot not found' });
    }
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;

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
    const passkeyBlock = await enforcePasskey(req, res, bot);
    if (passkeyBlock) return;
    
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
            await dataManager.addAdminLog(req.session.user.username, 'promote_user', username, null);
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
            await dataManager.addAdminLog(req.session.user.username, 'demote_user', username, null);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        console.error('Error demoting user:', err);
        res.json({ success: false, error: 'Failed to demote user' });
    }
});

router.post('/admin/create-user', async (req, res) => {
    // Check if user has admin privileges
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can create users.' });
    }

    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password are required.' });
    }
    if (password.length < 6) {
        return res.json({ success: false, error: 'Password must be at least 6 characters long.' });
    }
    if (role && role !== 'admin' && role !== 'user') {
        return res.json({ success: false, error: 'Invalid role.' });
    }

    try {
        const existingUser = await dataManager.getAdmin(username);
        if (existingUser) {
            return res.json({ success: false, error: 'Username already exists.' });
        }
        const created = await dataManager.createAdmin(username, password, role || 'user');
        if (!created) {
            return res.json({ success: false, error: 'Failed to create user.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'create_user', username, { role: role || 'user' });
        res.json({ success: true });
    } catch (err) {
        console.error('Error creating user:', err);
        res.json({ success: false, error: 'Failed to create user.' });
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
            await dataManager.addAdminLog(req.session.user.username, 'assign_bot_to_user', String(botId), { username });
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
            await dataManager.addAdminLog(req.session.user.username, 'unassign_bot_from_user', String(botId), null);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Bot not found or unassignment failed' });
        }
    } catch (err) {
        console.error('Error unassigning bot:', err);
        res.json({ success: false, error: 'Failed to unassign bot' });
    }
});

// Server Profile Routes
router.post('/servers/create', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can create servers.' });
    }

    const { name, ip, port, version, maxBots, region, notes, whitelist } = req.body;
    if (!name || !ip || !port || !version) {
        return res.json({ success: false, error: 'Name, IP, port, and version are required.' });
    }

    try {
        const created = await dataManager.createServer({
            name,
            ip,
            port,
            version,
            maxBots,
            region,
            notes,
            whitelist
        });
        if (!created) {
            return res.json({ success: false, error: 'Failed to create server profile.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'create_server', created._id.toString(), {
            name: created.name,
            ip: created.ip,
            port: created.port,
            version: created.version
        });
        res.json({ success: true, server: created });
    } catch (err) {
        console.error('Error creating server profile:', err);
        res.json({ success: false, error: 'Failed to create server profile.' });
    }
});

router.post('/servers/update', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can update servers.' });
    }

    const { serverId, name, ip, port, version, maxBots, region, notes, whitelist } = req.body;
    if (!serverId || !name || !ip || !port || !version) {
        return res.json({ success: false, error: 'Server ID, name, IP, port, and version are required.' });
    }

    try {
        const updated = await dataManager.updateServer(serverId, {
            name,
            ip,
            port: parseInt(port) || 25565,
            version,
            maxBots: parseInt(maxBots) || 0,
            region: region || '',
            notes: notes || '',
            whitelist: whitelist === true || whitelist === 'true'
        });
        if (!updated) {
            return res.json({ success: false, error: 'Failed to update server profile.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'update_server', serverId, {
            name: updated.name,
            ip: updated.ip,
            port: updated.port,
            version: updated.version
        });
        res.json({ success: true, server: updated });
    } catch (err) {
        console.error('Error updating server profile:', err);
        res.json({ success: false, error: 'Failed to update server profile.' });
    }
});

router.post('/servers/delete', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can delete servers.' });
    }

    const { serverId } = req.body;
    if (!serverId) {
        return res.json({ success: false, error: 'Server ID is required.' });
    }

    try {
        const success = await dataManager.deleteServer(serverId);
        if (!success) {
            return res.json({ success: false, error: 'Failed to delete server profile.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'delete_server', serverId, null);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting server profile:', err);
        res.json({ success: false, error: 'Failed to delete server profile.' });
    }
});

router.post('/servers/assign-bot', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can assign bots to servers.' });
    }

    const { botId, serverId, applyProfile } = req.body;
    if (!botId) {
        return res.json({ success: false, error: 'Bot ID is required.' });
    }

    try {
        const updated = await dataManager.assignBotToServer(botId, serverId || null, applyProfile === true || applyProfile === 'true');
        if (!updated) {
            return res.json({ success: false, error: 'Failed to assign bot to server.' });
        }
        if (updated.error === 'max_bots_reached') {
            return res.json({ success: false, error: 'Server has reached max bots limit.' });
        }
        const botInstance = botManager.getBotInstance(botId);
        if (botInstance) {
            botInstance.updateConfig(updated);
        }
        await dataManager.addAdminLog(req.session.user.username, 'assign_bot_to_server', String(botId), {
            serverId: serverId || null,
            applyProfile: applyProfile === true || applyProfile === 'true'
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Error assigning bot to server:', err);
        res.json({ success: false, error: 'Failed to assign bot to server.' });
    }
});

module.exports = router;
