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

// Admin Delete User
router.post('/admin/delete-user', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can delete users.' });
    }

    const { username } = req.body;
    if (!username) {
        return res.json({ success: false, error: 'Username is required.' });
    }

    if (username === req.session.user.username) {
        return res.json({ success: false, error: 'You cannot delete your own account.' });
    }

    if (username === 'root') {
        return res.json({ success: false, error: 'Cannot delete the master root account.' });
    }

    try {
        const deleted = await dataManager.deleteAdmin(username);
        if (!deleted) {
            return res.json({ success: false, error: 'User not found or deletion failed.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'delete_user', username, null);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.json({ success: false, error: 'Failed to delete user.' });
    }
});

// Admin Reset Password
router.post('/admin/reset-password', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can reset passwords.' });
    }

    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.json({ success: false, error: 'Username and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    try {
        const updated = await dataManager.updateAdminPassword(username, newPassword);
        if (!updated) {
            return res.json({ success: false, error: 'User not found or update failed.' });
        }
        await dataManager.addAdminLog(req.session.user.username, 'reset_password', username, null);
        res.json({ success: true });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.json({ success: false, error: 'Failed to reset password.' });
    }
});

// Admin Update Global Settings
router.post('/admin/settings', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only administrators can update settings.' });
    }

    try {
        const { autoReconnect, reconnectDelay, defaultVersion, passkeyEnforced, darkModeDefault } = req.body;
        const newSettings = {};

        if (typeof autoReconnect !== 'undefined') newSettings.autoReconnect = autoReconnect === true || autoReconnect === 'true';
        if (typeof reconnectDelay !== 'undefined') newSettings.reconnectDelay = Math.max(1, parseInt(reconnectDelay) || 10);
        if (defaultVersion) newSettings.defaultVersion = defaultVersion;
        if (typeof passkeyEnforced !== 'undefined') newSettings.passkeyEnforced = passkeyEnforced === true || passkeyEnforced === 'true';
        if (typeof darkModeDefault !== 'undefined') newSettings.darkMode = darkModeDefault === true || darkModeDefault === 'true';

        const updated = await dataManager.updateSettings(newSettings);
        await dataManager.addAdminLog(req.session.user.username, 'update_settings', 'global', newSettings);
        res.json({ success: true, settings: updated });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.json({ success: false, error: 'Failed to update settings.' });
    }
});

// Fleet Bulk Actions: Start All
router.post('/admin/bots/start-all', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }

    const allBots = await dataManager.getBots();
    let startedCount = 0;
    allBots.forEach(b => {
        const instance = botManager.getBotInstance(b.id);
        if (instance && !instance.isRunning) {
            instance.start();
            startedCount++;
        }
    });

    await dataManager.addAdminLog(req.session.user.username, 'fleet_start_all', 'fleet', { startedCount });
    res.json({ success: true, startedCount });
});

// Fleet Bulk Actions: Stop All
router.post('/admin/bots/stop-all', async (req, res) => {
    const currentUser = await dataManager.getAdmin(req.session.user.username);
    if (currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }

    const allBots = await dataManager.getBots();
    let stoppedCount = 0;
    allBots.forEach(b => {
        const instance = botManager.getBotInstance(b.id);
        if (instance && instance.isRunning) {
            instance.stop();
            stoppedCount++;
        }
    });

    await dataManager.addAdminLog(req.session.user.username, 'fleet_stop_all', 'fleet', { stoppedCount });
    res.json({ success: true, stoppedCount });
});

// ===== NEW FEATURE ENDPOINTS =====

// Set AFK Profile
router.post('/bot/:id/afk-profile', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const { profile } = req.body;
    const valid = ['random_look', 'circle_walk', 'jump_spam', 'spin'];
    if (!valid.includes(profile)) {
        return res.json({ success: false, error: 'Invalid AFK profile.' });
    }
    const updated = await dataManager.updateBot(req.params.id, { afkProfile: profile });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    await dataManager.addAdminLog(req.session.user.username, 'set_afk_profile', String(req.params.id), { profile });
    res.json({ success: true, profile });
});

// Toggle Auto-Eat
router.post('/bot/:id/auto-eat', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const { enabled } = req.body;
    const autoEat = enabled === true || enabled === 'true';
    const updated = await dataManager.updateBot(req.params.id, { autoEat });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    res.json({ success: true, autoEat });
});

// Toggle Auto-Start
router.post('/bot/:id/auto-start', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied. Only admins can change auto-start.' });
    }
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    const { enabled } = req.body;
    const autoStart = enabled === true || enabled === 'true';
    const updated = await dataManager.updateBot(req.params.id, { autoStart });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    res.json({ success: true, autoStart });
});

// Set Webhook URL
router.post('/bot/:id/webhook', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const { webhookUrl } = req.body;
    const updated = await dataManager.updateBot(req.params.id, { webhookUrl: webhookUrl || '' });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    res.json({ success: true });
});

// Set Login Commands
router.post('/bot/:id/login-commands', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    let { commands } = req.body;
    if (typeof commands === 'string') {
        commands = commands.split('\n').map(c => c.trim()).filter(Boolean);
    }
    if (!Array.isArray(commands)) commands = [];
    const updated = await dataManager.updateBot(req.params.id, { loginCommands: commands });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    res.json({ success: true, commands });
});

// Set Notes
router.post('/bot/:id/notes', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    if (user.role !== 'admin' && bot.assignedTo !== req.session.user.username) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const { notes } = req.body;
    const updated = await dataManager.updateBot(req.params.id, { notes: notes || '' });
    if (!updated) return res.json({ success: false, error: 'Failed to update.' });
    const instance = botManager.getBotInstance(req.params.id);
    if (instance) instance.updateConfig(updated);
    res.json({ success: true });
});

// Get Bot Events (Timeline)
router.get('/bot/:id/events', async (req, res) => {
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    const BotEvent = require('../models/BotEvent');
    const { limit = 50 } = req.query;
    const events = await BotEvent.find({ botId: parseInt(req.params.id) })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();
    res.json({ success: true, events: events.reverse() });
});

// Get Bot Metrics (Health/Food History)
router.get('/bot/:id/metrics', async (req, res) => {
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    const BotMetric = require('../models/BotMetric');
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const metrics = await BotMetric.find({
        botId: parseInt(req.params.id),
        timestamp: { $gte: since }
    }).sort({ timestamp: 1 }).lean();
    res.json({ success: true, metrics });
});

// Search Console Logs
router.get('/bot/:id/history/search', async (req, res) => {
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.json({ success: false, error: 'Bot not found' });
    const BotLog = require('../models/BotLog');
    const { keyword, type, from, to, limit = 200 } = req.query;

    const query = { botId: parseInt(req.params.id) };
    if (keyword) query.message = { $regex: keyword, $options: 'i' };
    if (type) query.type = type;
    if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
    }

    const logs = await BotLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();
    res.json({ success: true, logs: logs.reverse(), total: logs.length });
});

// Export Console Logs as .txt or .csv
router.get('/bot/:id/history/export', async (req, res) => {
    const bot = await dataManager.getBot(req.params.id);
    if (!bot) return res.status(404).send('Bot not found');
    const BotLog = require('../models/BotLog');
    const { format = 'txt' } = req.query;
    const logs = await BotLog.find({ botId: parseInt(req.params.id) })
        .sort({ timestamp: 1 })
        .lean();

    if (format === 'csv') {
        const header = 'timestamp,type,message\n';
        const rows = logs.map(l => {
            const ts = new Date(l.timestamp).toISOString();
            const msg = `"${(l.message || '').replace(/"/g, '""')}"`;
            return `${ts},${l.type},${msg}`;
        }).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bot_${req.params.id}_logs.csv"`);
        return res.send(header + rows);
    } else {
        const content = logs.map(l => {
            const ts = new Date(l.timestamp).toISOString();
            return `[${ts}] [${(l.type || 'info').toUpperCase()}] ${l.message}`;
        }).join('\n');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="bot_${req.params.id}_logs.txt"`);
        return res.send(content);
    }
});

// Clone Bot
router.post('/bots/clone/:id', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const cloned = await botManager.cloneBot(req.params.id);
    if (!cloned) return res.json({ success: false, error: 'Failed to clone bot.' });
    await dataManager.addAdminLog(req.session.user.username, 'clone_bot', String(req.params.id), { newId: cloned.id });
    res.json({ success: true, bot: cloned });
});

// Export All Bots as JSON
router.get('/bots/export', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const bots = await dataManager.getBots();
    const exportData = bots.map(b => ({
        name: b.name,
        server: b.server,
        account: { email: b.account?.email || '' },
        afkProfile: b.afkProfile || 'random_look',
        autoEat: b.autoEat !== false,
        autoStart: b.autoStart === true,
        loginCommands: b.loginCommands || [],
        notes: b.notes || '',
        webhookUrl: b.webhookUrl || ''
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bots_export_${Date.now()}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
});

// Import Bots from JSON
router.post('/bots/import', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
    }
    const { bots } = req.body;
    if (!Array.isArray(bots) || bots.length === 0) {
        return res.json({ success: false, error: 'Invalid import data. Expected array of bot configs.' });
    }
    let imported = 0;
    const errors = [];
    for (const botData of bots) {
        try {
            const newBot = await botManager.createBot({
                name: botData.name || 'Imported Bot',
                ip: botData.server?.ip || 'localhost',
                port: botData.server?.port || 25565,
                version: botData.server?.version || '1.20.4',
                email: botData.account?.email || '',
                afkProfile: botData.afkProfile || 'random_look',
                autoEat: botData.autoEat !== false,
                autoStart: false, // never auto-start imports
                loginCommands: botData.loginCommands || [],
                notes: botData.notes || '',
                webhookUrl: botData.webhookUrl || ''
            });
            if (newBot) imported++;
        } catch (err) {
            errors.push(err.message);
        }
    }
    await dataManager.addAdminLog(req.session.user.username, 'import_bots', 'bulk', { imported, errors: errors.length });
    res.json({ success: true, imported, errors });
});

// --- Template Routes ---

// List Templates
router.get('/templates', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: 'Permission denied.' });
    const templates = await botManager.getTemplates();
    res.json({ success: true, templates });
});

// Create Template from Bot
router.post('/templates/create', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: 'Permission denied.' });
    const { botId, templateName } = req.body;
    if (!botId) return res.json({ success: false, error: 'Bot ID is required.' });
    const template = await botManager.createTemplateFromBot(botId, templateName, req.session.user.username);
    if (!template) return res.json({ success: false, error: 'Failed to create template.' });
    await dataManager.addAdminLog(req.session.user.username, 'create_template', String(botId), { templateName });
    res.json({ success: true, template });
});

// Spawn Bot from Template
router.post('/templates/spawn', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: 'Permission denied.' });
    const { templateId } = req.body;
    if (!templateId) return res.json({ success: false, error: 'Template ID is required.' });
    const newBot = await botManager.createBotFromTemplate(templateId);
    if (!newBot) return res.json({ success: false, error: 'Failed to spawn bot from template.' });
    await dataManager.addAdminLog(req.session.user.username, 'spawn_from_template', templateId, { newBotId: newBot.id });
    res.json({ success: true, bot: newBot });
});

// Delete Template
router.post('/templates/delete', async (req, res) => {
    const user = await dataManager.getAdmin(req.session.user.username);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: 'Permission denied.' });
    const { templateId } = req.body;
    if (!templateId) return res.json({ success: false, error: 'Template ID is required.' });
    const deleted = await botManager.deleteTemplate(templateId);
    if (!deleted) return res.json({ success: false, error: 'Failed to delete template.' });
    await dataManager.addAdminLog(req.session.user.username, 'delete_template', templateId, null);
    res.json({ success: true });
});

module.exports = router;


