const Admin = require('../models/Admin');
const Bot = require('../models/Bot');
const Setting = require('../models/Setting');

async function readData() {
    try {
        const [admins, bots, settings] = await Promise.all([
            Admin.find({}).lean(),
            Bot.find({}).lean(),
            Setting.find({}).lean()
        ]);

        // Convert settings array to object
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });

        return {
            admins,
            bots,
            settings: settingsObj
        };
    } catch (err) {
        console.error("Error reading data from MongoDB:", err);
        return { admins: [], settings: {}, bots: [] };
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

async function addBot(botData) {
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
            created: Date.now()
        });

        const savedBot = await newBot.save();
        return savedBot.toObject();
    } catch (err) {
        console.error("Error adding bot to MongoDB:", err);
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

module.exports = {
    readData,
    getSettings,
    updateSettings,
    getAdmin,
    getBots,
    getBot,
    addBot,
    updateBot,
    deleteBot
};
