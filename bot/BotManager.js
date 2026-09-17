const BotInstance = require('./BotInstance');
const dataManager = require('../utils/dataManager');
const BotTemplate = require('../models/BotTemplate');
const Bot = require('../models/Bot');
const Sentry = require('@sentry/node');

let bots = new Map(); // id -> BotInstance
let io = null;

async function init(socketIo) {
    io = socketIo;
    const botsData = await dataManager.getBots();
    for (const botData of botsData) {
        if (!bots.has(botData.id)) {
            const instance = new BotInstance(botData.id, botData, io);
            bots.set(botData.id, instance);

            // Auto-start bots that have autoStart enabled
            if (botData.autoStart === true) {
                setTimeout(() => {
                    try {
                        instance.start();
                    } catch (e) {
                        console.error(`[BotManager] Auto-start failed for bot ${botData.id}:`, e);
                        Sentry.captureException(e, { tags: { botId: String(botData.id), operation: 'auto-start' } });
                    }
                }, 2000 + botData.id * 500); // stagger starts to avoid simultaneous auth requests
            }
        }
    }
}

function getBotInstance(id) {
    return bots.get(parseInt(id));
}

function getAllBotsStatus() {
    const statuses = [];
    bots.forEach(bot => {
        statuses.push(bot.getStatus());
    });
    return statuses;
}

async function createBot(data, assignedTo = null) {
    const newBotData = await dataManager.addBot(data, assignedTo);
    if (!newBotData) {
        return null;
    }
    const botInstance = new BotInstance(newBotData.id, newBotData, io);
    bots.set(newBotData.id, botInstance);
    return newBotData;
}

function deleteBot(id) {
    const bot = bots.get(parseInt(id));
    if (bot) {
        bot.stop();
        bot.clearConsoleHistory();
        bots.delete(parseInt(id));
        return dataManager.deleteBot(id);
    }
    return false;
}

async function updateBotConfig(id, updates) {
    const updatedData = await dataManager.updateBot(id, updates);
    if (updatedData) {
        const bot = bots.get(parseInt(id));
        if (bot) {
            bot.updateConfig(updatedData);
        }
    }
    return updatedData;
}

// Proxy methods to BotInstance
function startBot(id) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.start();
}

function stopBot(id) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.stop();
}

function restartBot(id) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.restart();
}

function startAfk(id) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.startAfk();
}

function stopAfk(id) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.stopAfk();
}

function chat(id, message) {
    const bot = bots.get(parseInt(id));
    if (bot) bot.chat(message);
}

function getStatus(id) {
    const bot = bots.get(parseInt(id));
    return bot ? bot.getStatus() : null;
}

function getLogHistory(id, count = 100) {
    const bot = bots.get(parseInt(id));
    return bot ? bot.getLogHistory(count) : [];
}

function clearConsoleHistory(id) {
    const bot = bots.get(parseInt(id));
    if (bot) {
        bot.clearConsoleHistory();
        return true;
    }
    return false;
}

// --- Clone Bot ---
async function cloneBot(id) {
    const originalData = await dataManager.getBot(id);
    if (!originalData) return null;

    const cloneData = {
        name: `${originalData.name} (Copy)`,
        ip: originalData.server?.ip || 'localhost',
        port: originalData.server?.port || 25565,
        version: originalData.server?.version || '1.20.4',
        email: originalData.account?.email || '',
        afkProfile: originalData.afkProfile || 'random_look',
        autoEat: originalData.autoEat !== false,
        autoStart: false, // don't auto-start clones
        webhookUrl: originalData.webhookUrl || '',
        loginCommands: originalData.loginCommands || [],
        notes: originalData.notes || '',
        serverProfile: null
    };

    const newBotData = await dataManager.addBot(cloneData);
    if (!newBotData) return null;

    const botInstance = new BotInstance(newBotData.id, newBotData, io);
    bots.set(newBotData.id, botInstance);
    return newBotData;
}

// --- Templates ---
async function createTemplateFromBot(id, templateName, createdBy = 'admin') {
    const botData = await dataManager.getBot(id);
    if (!botData) return null;

    const template = new BotTemplate({
        name: templateName || `${botData.name} Template`,
        server: {
            ip: botData.server?.ip || 'localhost',
            port: botData.server?.port || 25565,
            version: botData.server?.version || '1.20.4'
        },
        account: {
            email: botData.account?.email || ''
        },
        afkProfile: botData.afkProfile || 'random_look',
        autoEat: botData.autoEat !== false,
        autoStart: false,
        loginCommands: botData.loginCommands || [],
        notes: botData.notes || '',
        createdBy
    });

    await template.save();
    return template.toObject();
}

async function createBotFromTemplate(templateId) {
    const template = await BotTemplate.findById(templateId).lean();
    if (!template) return null;

    const botData = {
        name: template.name,
        ip: template.server?.ip || 'localhost',
        port: template.server?.port || 25565,
        version: template.server?.version || '1.20.4',
        email: template.account?.email || '',
        afkProfile: template.afkProfile || 'random_look',
        autoEat: template.autoEat !== false,
        autoStart: template.autoStart === true,
        loginCommands: template.loginCommands || [],
        notes: template.notes || ''
    };

    const newBotData = await dataManager.addBot(botData);
    if (!newBotData) return null;

    const botInstance = new BotInstance(newBotData.id, newBotData, io);
    bots.set(newBotData.id, botInstance);
    return newBotData;
}

async function getTemplates() {
    return await BotTemplate.find({}).sort({ createdAt: -1 }).lean();
}

async function deleteTemplate(templateId) {
    const result = await BotTemplate.deleteOne({ _id: templateId });
    return result.deletedCount > 0;
}

module.exports = {
    init,
    getBotInstance,
    getAllBotsStatus,
    createBot,
    deleteBot,
    updateBotConfig,
    startBot,
    stopBot,
    restartBot,
    startAfk,
    stopAfk,
    chat,
    getStatus,
    getLogHistory,
    clearConsoleHistory,
    cloneBot,
    createTemplateFromBot,
    createBotFromTemplate,
    getTemplates,
    deleteTemplate
};
