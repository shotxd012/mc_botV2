const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/data.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            return { admins: [], settings: {}, bots: [] };
        }
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        let data = JSON.parse(raw);

        // Migration Logic: Convert single bot structure to multi-bot
        if (!data.bots) {
            data.bots = [];
            // If legacy data exists, migrate it to the first bot
            if (data.server || data.minecraftAccount) {
                data.bots.push({
                    id: 1,
                    name: "Default Bot",
                    server: data.server || { ip: 'localhost', port: 25565, version: '1.20.4' },
                    account: data.minecraftAccount || { email: '', auth: 'microsoft' },
                    created: Date.now()
                });
                delete data.server;
                delete data.minecraftAccount;
                // Save the migration immediately
                fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
            }
        }

        return data;
    } catch (err) {
        console.error("Error reading data.json:", err);
        return { admins: [], settings: {}, bots: [] };
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

// --- Global Settings ---

function getSettings() {
    return readData().settings || {};
}

function updateSettings(newSettings) {
    const data = readData();
    data.settings = { ...data.settings, ...newSettings };
    writeData(data);
    return data.settings;
}

function getAdmin(username) {
    const data = readData();
    return data.admins ? data.admins.find(a => a.username === username) : null;
}

// --- Bot Management ---

function getBots() {
    return readData().bots || [];
}

function getBot(id) {
    const bots = getBots();
    return bots.find(b => b.id === parseInt(id));
}

function addBot(botData) {
    const data = readData();
    if (!data.bots) data.bots = [];

    // Generate new ID
    const newId = data.bots.length > 0 ? Math.max(...data.bots.map(b => b.id)) + 1 : 1;

    const newBot = {
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
    };

    data.bots.push(newBot);
    writeData(data);
    return newBot;
}

function updateBot(id, updates) {
    const data = readData();
    const index = data.bots.findIndex(b => b.id === parseInt(id));

    if (index !== -1) {
        // Deep merge for server and account if provided
        if (updates.server) {
            data.bots[index].server = { ...data.bots[index].server, ...updates.server };
            delete updates.server;
        }
        if (updates.account) {
            data.bots[index].account = { ...data.bots[index].account, ...updates.account };
            delete updates.account;
        }

        // Merge remaining top-level properties
        data.bots[index] = { ...data.bots[index], ...updates };

        writeData(data);
        return data.bots[index];
    }
    return null;
}

function deleteBot(id) {
    const data = readData();
    const initialLength = data.bots.length;
    data.bots = data.bots.filter(b => b.id !== parseInt(id));

    if (data.bots.length !== initialLength) {
        writeData(data);
        return true;
    }
    return false;
}

module.exports = {
    readData,
    writeData,
    getSettings,
    updateSettings,
    getAdmin,
    getBots,
    getBot,
    addBot,
    updateBot,
    deleteBot
};
