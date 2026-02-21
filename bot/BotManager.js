const BotInstance = require('./BotInstance');
const dataManager = require('../utils/dataManager');

let bots = new Map(); // id -> BotInstance
let io = null;

async function init(socketIo) {
    io = socketIo;
    const botsData = await dataManager.getBots();
    botsData.forEach(botData => {
        // Only add if not already present (though init should only run once)
        if (!bots.has(botData.id)) {
            bots.set(botData.id, new BotInstance(botData.id, botData, io));
        }
    });
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

async function createBot(data) {
    const newBotData = await dataManager.addBot(data);
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
        bot.clearConsoleHistory(); // Clean up console history file
        bots.delete(parseInt(id));
        return dataManager.deleteBot(id);
    }
    return false;
}

function updateBotConfig(id, updates) {
    const updatedData = dataManager.updateBot(id, updates);
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
    clearConsoleHistory
};
