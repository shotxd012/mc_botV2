const Admin = require('../models/Admin');
const AdminLog = require('../models/AdminLog');
const Bot = require('../models/Bot');
const Setting = require('../models/Setting');
const Server = require('../models/Server');

async function readData() {
    try {
        const [admins, bots, settings, servers] = await Promise.all([
            Admin.find({}).lean(),
            Bot.find({}).lean(),
            Setting.find({}).lean(),
            Server.find({}).lean()
        ]);

        // Convert settings array to object
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });

        return {
            admins,
            bots,
            settings: settingsObj,
            servers
        };
    } catch (err) {
        console.error("Error reading data from MongoDB:", err);
        return { admins: [], settings: {}, bots: [], servers: [] };
    }
}

// --- Admin Logs ---

async function addAdminLog(actor, action, target = '', details = null) {
    try {
        const log = new AdminLog({ actor, action, target, details });
        await log.save();
        return true;
    } catch (err) {
        console.error("Error creating admin log:", err);
        return false;
    }
}

async function getAdminLogs(limit = 100) {
    try {
        return await AdminLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
        console.error("Error getting admin logs:", err);
        return [];
    }
}

// writeData function is no longer needed as we use individual model methods

// --- Global Settings ---

async function getSettings() {
    try {
        const settings = await Setting.find({}).lean();
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });
        return settingsObj;
    } catch (err) {
        console.error("Error getting settings from MongoDB:", err);
        return {};
    }
}

async function updateSettings(newSettings) {
    try {
        for (const [key, value] of Object.entries(newSettings)) {
            await Setting.findOneAndUpdate(
                { key },
                { key, value },
                { upsert: true, new: true }
            );
        }
        
        return await getSettings();
    } catch (err) {
        console.error("Error updating settings in MongoDB:", err);
        return {};
    }
}

async function getAdmin(username) {
    try {
        return await Admin.findOne({ username }).lean();
    } catch (err) {
        console.error("Error getting admin from MongoDB:", err);
        return null;
    }
}

async function getAllAdmins() {
    try {
        return await Admin.find({}).lean();
    } catch (err) {
        console.error("Error getting all admins from MongoDB:", err);
        return [];
    }
}

async function createAdmin(username, password, role = 'user') {
    try {
        // Hash the password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newAdmin = new Admin({
            username,
            password: hashedPassword,
            role
        });
        
        const savedAdmin = await newAdmin.save();
        return savedAdmin.toObject();
    } catch (err) {
        console.error("Error creating admin in MongoDB:", err);
        return null;
    }
}

// --- Bot Management ---

async function getBots() {
    try {
        return await Bot.find({}).lean();
    } catch (err) {
        console.error("Error getting bots from MongoDB:", err);
        return [];
    }
}

async function getBot(id) {
    try {
        return await Bot.findOne({ id: parseInt(id) }).lean();
    } catch (err) {
        console.error("Error getting bot from MongoDB:", err);
        return null;
    }
}

async function addBot(botData, assignedTo = null) {
    try {
        // Find the highest existing ID to generate a new one
        const maxBot = await Bot.findOne().sort({ id: -1 }).lean();
        const newId = maxBot ? maxBot.id + 1 : 1;

        const newBot = new Bot({
            id: newId,
            name: botData.name || `Bot ${newId}`,
            server: {
                ip: botData.ip || 'localhost',
                port: parseInt(botData.port) || 25565,
                version: botData.version || '1.20.4'
            },
            account: {
                email: botData.email || '',
                type: 'microsoft',
                verified: false,
                authCache: null
            },
            serverProfile: botData.serverProfile || null,
            assignedTo: assignedTo,
            created: Date.now()
        });

        const savedBot = await newBot.save();
        return savedBot.toObject();
    } catch (err) {
        console.error("Error adding bot to MongoDB:", err);
        return null;
    }
}

// --- Server Profiles ---

async function getServers() {
    try {
        return await Server.find({}).lean();
    } catch (err) {
        console.error("Error getting servers from MongoDB:", err);
        return [];
    }
}

async function getServer(id) {
    try {
        return await Server.findById(id).lean();
    } catch (err) {
        console.error("Error getting server from MongoDB:", err);
        return null;
    }
}

async function createServer(serverData) {
    try {
        const newServer = new Server({
            name: serverData.name,
            ip: serverData.ip,
            port: parseInt(serverData.port) || 25565,
            version: serverData.version || '1.20.4',
            maxBots: parseInt(serverData.maxBots) || 0,
            region: serverData.region || '',
            whitelist: serverData.whitelist === true || serverData.whitelist === 'true',
            notes: serverData.notes || ''
        });
        const savedServer = await newServer.save();
        return savedServer.toObject();
    } catch (err) {
        console.error("Error creating server in MongoDB:", err);
        return null;
    }
}

async function updateServer(id, updates) {
    try {
        const server = await Server.findById(id);
        if (!server) {
            return null;
        }
        Object.assign(server, updates);
        const updatedServer = await server.save();
        return updatedServer.toObject();
    } catch (err) {
        console.error("Error updating server in MongoDB:", err);
        return null;
    }
}

async function deleteServer(id) {
    try {
        const server = await Server.findById(id);
        if (!server) {
            return false;
        }
        await Bot.updateMany({ serverProfile: id }, { serverProfile: null });
        await Server.deleteOne({ _id: id });
        return true;
    } catch (err) {
        console.error("Error deleting server in MongoDB:", err);
        return false;
    }
}

async function assignBotToServer(botId, serverId, applyProfile = false) {
    try {
        const bot = await Bot.findOne({ id: parseInt(botId) });
        if (!bot) {
            return null;
        }

        if (!serverId) {
            bot.serverProfile = null;
            const updatedBot = await bot.save();
            return updatedBot.toObject();
        }

        const server = await Server.findById(serverId);
        if (!server) {
            return null;
        }

        if (server.maxBots && server.maxBots > 0) {
            const isSameServer = bot.serverProfile && String(bot.serverProfile) === String(server._id);
            if (!isSameServer) {
                const assignedCount = await Bot.countDocuments({ serverProfile: server._id });
                if (assignedCount >= server.maxBots) {
                    return { error: 'max_bots_reached' };
                }
            }
        }

        bot.serverProfile = server._id;
        if (applyProfile) {
            bot.server = {
                ip: server.ip,
                port: server.port,
                version: server.version
            };
        }

        const updatedBot = await bot.save();
        return updatedBot.toObject();
    } catch (err) {
        console.error("Error assigning bot to server in MongoDB:", err);
        return null;
    }
}

async function updateBot(id, updates) {
    try {
        const bot = await Bot.findOne({ id: parseInt(id) });
        if (!bot) {
            return null;
        }

        // Deep merge for server and account if provided
        if (updates.server) {
            bot.server = { ...bot.server, ...updates.server };
            delete updates.server;
        }
        if (updates.account) {
            bot.account = { ...bot.account, ...updates.account };
            delete updates.account;
        }

        // Merge remaining top-level properties
        Object.assign(bot, updates);

        const updatedBot = await bot.save();
        return updatedBot.toObject();
    } catch (err) {
        console.error("Error updating bot in MongoDB:", err);
        return null;
    }
}

async function deleteBot(id) {
    try {
        const result = await Bot.deleteOne({ id: parseInt(id) });
        return result.deletedCount > 0;
    } catch (err) {
        console.error("Error deleting bot from MongoDB:", err);
        return false;
    }
}

async function getBotsByUser(username) {
    try {
        return await Bot.find({ assignedTo: username }).lean();
    } catch (err) {
        console.error("Error getting bots by user from MongoDB:", err);
        return [];
    }
}

async function assignBotToUser(botId, username) {
    try {
        const result = await Bot.updateOne({ id: parseInt(botId) }, { assignedTo: username });
        return result.modifiedCount > 0;
    } catch (err) {
        console.error("Error assigning bot to user in MongoDB:", err);
        return false;
    }
}

async function unassignBot(botId) {
    try {
        const result = await Bot.updateOne({ id: parseInt(botId) }, { assignedTo: null });
        return result.modifiedCount > 0;
    } catch (err) {
        console.error("Error unassigning bot in MongoDB:", err);
        return false;
    }
}

module.exports = {
    readData,
    addAdminLog,
    getAdminLogs,
    getSettings,
    updateSettings,
    getAdmin,
    createAdmin,
    getAllAdmins,
    getBots,
    getBot,
    addBot,
    updateBot,
    deleteBot,
    getBotsByUser,
    assignBotToUser,
    unassignBot,
    getServers,
    getServer,
    createServer,
    updateServer,
    deleteServer,
    assignBotToServer
};
