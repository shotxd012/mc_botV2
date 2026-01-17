const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/data.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            // Should have been created by init, but fallback just in case
            return {};
        }
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error("Error reading data.json:", err);
        return {};
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error("Error writing data.json:", err);
        return false;
    }
}

function getSettings() {
    return readData().settings || {};
}

function updateSettings(newSettings) {
    const data = readData();
    data.settings = { ...data.settings, ...newSettings };
    writeData(data);
    return data.settings;
}

function getServerConfig() {
    return readData().server || {};
}

function updateServerConfig(config) {
    const data = readData();
    data.server = { ...data.server, ...config };
    writeData(data);
    return data.server;
}

function getMinecraftAccount() {
    return readData().minecraftAccount || {};
}

function updateMinecraftAccount(accountData) {
    const data = readData();
    data.minecraftAccount = { ...data.minecraftAccount, ...accountData };
    writeData(data);
    return data.minecraftAccount;
}

function getAdmin(username) {
    const data = readData();
    return data.admins.find(a => a.username === username);
}

module.exports = {
    readData,
    writeData,
    getSettings,
    updateSettings,
    getServerConfig,
    updateServerConfig,
    getMinecraftAccount,
    updateMinecraftAccount,
    getAdmin
};
