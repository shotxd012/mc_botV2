const express = require('express');
const router = express.Router();
const botManager = require('../bot/BotManager');
const dataManager = require('../utils/dataManager');
const { buildSystemStats } = require('../utils/systemStats');

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const user = await dataManager.getAdmin(req.session.user.username);
        if (!user || user.role !== 'admin') {
            return res.redirect('/');
        }
        req.adminUser = user;
        next();
    } catch (err) {
        console.error('Error verifying admin permissions:', err);
        res.redirect('/');
    }
};

router.use(requireAdmin);

// Helper to compute server counts
function computeServerCounts(bots) {
    const counts = {};
    bots.forEach(b => {
        if (b.serverProfile) {
            const key = String(b.serverProfile);
            counts[key] = (counts[key] || 0) + 1;
        }
    });
    return counts;
}

async function getOverviewData() {
    const [allUsers, allBots, allServers, adminLogs] = await Promise.all([
        dataManager.getAllAdmins(),
        dataManager.getBots(),
        dataManager.getServers(),
        dataManager.getAdminLogs(30)
    ]);
    const systemStats = await buildSystemStats({
        bots: allBots,
        botStatuses: botManager.getAllBotsStatus(),
        servers: allServers
    });
    return { allUsers, allBots, allServers, adminLogs, systemStats };
}

// 1. Overview Dashboard
router.get(['/', '/overview'], async (req, res) => {
    try {
        const { allUsers, allBots, allServers, adminLogs, systemStats } = await getOverviewData();

        res.render('admin/overview', {
            page: 'admin-overview',
            adminTab: 'overview',
            user: req.adminUser,
            users: allUsers,
            bots: allBots,
            servers: allServers,
            logs: adminLogs,
            systemStats
        });
    } catch (err) {
        console.error('Admin overview error:', err);
        res.status(500).send('Internal server error');
    }
});

router.get('/api/overview', async (req, res) => {
    try {
        const { allUsers, systemStats } = await getOverviewData();
        res.json({
            success: true,
            users: allUsers.length,
            systemStats,
            updatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Admin overview API error:', err);
        res.status(500).json({ success: false, error: 'Unable to read system telemetry' });
    }
});

// 2. Bot Fleet & Assignments
router.get('/bots', async (req, res) => {
    try {
        const [allUsers, allBots, allServers] = await Promise.all([
            dataManager.getAllAdmins(),
            dataManager.getBots(),
            dataManager.getServers()
        ]);
        const botStatuses = botManager.getAllBotsStatus();
        const serverCounts = computeServerCounts(allBots);

        // Map bots with their real-time running status
        const enrichedBots = allBots.map(bot => {
            const status = botManager.getStatus(bot.id);
            return {
                ...bot,
                liveStatus: status || { online: false, isRunning: false, uptime: '0s', health: '-', food: '-' }
            };
        });

        res.render('admin/bots', {
            page: 'admin-bots',
            adminTab: 'bots',
            user: req.adminUser,
            users: allUsers,
            bots: enrichedBots,
            servers: allServers,
            serverCounts
        });
    } catch (err) {
        console.error('Admin bots error:', err);
        res.status(500).send('Internal server error');
    }
});

// 3. Server Profiles
router.get('/servers', async (req, res) => {
    try {
        const [allServers, allBots] = await Promise.all([
            dataManager.getServers(),
            dataManager.getBots()
        ]);
        const serverCounts = computeServerCounts(allBots);

        res.render('admin/servers', {
            page: 'admin-servers',
            adminTab: 'servers',
            user: req.adminUser,
            servers: allServers,
            bots: allBots,
            serverCounts
        });
    } catch (err) {
        console.error('Admin servers error:', err);
        res.status(500).send('Internal server error');
    }
});

// 4. User Access Management
router.get('/users', async (req, res) => {
    try {
        const [allUsers, allBots] = await Promise.all([
            dataManager.getAllAdmins(),
            dataManager.getBots()
        ]);

        // Calculate assigned bot counts per user
        const userBotCounts = {};
        allBots.forEach(bot => {
            if (bot.assignedTo) {
                userBotCounts[bot.assignedTo] = (userBotCounts[bot.assignedTo] || 0) + 1;
            }
        });

        res.render('admin/users', {
            page: 'admin-users',
            adminTab: 'users',
            user: req.adminUser,
            users: allUsers,
            userBotCounts,
            totalBots: allBots.length
        });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).send('Internal server error');
    }
});

router.get('/users/:username', async (req, res) => {
    try {
        const target = await dataManager.getAdmin(req.params.username);
        if (!target) return res.status(404).send('User not found');
        const [allBots, allUsers] = await Promise.all([
            dataManager.getBots(),
            dataManager.getAllAdmins()
        ]);
        res.render('admin/user-detail', {
            page: 'admin-users',
            adminTab: 'users',
            user: req.adminUser,
            target,
            bots: allBots,
            users: allUsers,
            assignedBots: allBots.filter(bot => bot.assignedTo === target.username)
        });
    } catch (err) {
        console.error('Admin user detail error:', err);
        res.status(500).send('Internal server error');
    }
});

// 5. Audit Logs Explorer
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const allLogs = await dataManager.getAdminLogs(limit);

        res.render('admin/logs', {
            page: 'admin-logs',
            adminTab: 'logs',
            user: req.adminUser,
            logs: allLogs
        });
    } catch (err) {
        console.error('Admin logs error:', err);
        res.status(500).send('Internal server error');
    }
});

// 6. Global System Settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await dataManager.getSettings();
        const [allBots, allServers] = await Promise.all([
            dataManager.getBots(),
            dataManager.getServers()
        ]);

        res.render('admin/settings', {
            page: 'admin-settings',
            adminTab: 'settings',
            user: req.adminUser,
            settings,
            botCount: allBots.length,
            serverCount: allServers.length
        });
    } catch (err) {
        console.error('Admin settings error:', err);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
