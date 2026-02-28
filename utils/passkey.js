const PROTECTED_BOT_IDS = new Map([
    [1, 'REDACTED_BOT_PASSKEY']
]);

function requiresPasskeyForBot(botConfig) {
    if (botConfig && typeof botConfig.id !== 'undefined') {
        const botId = parseInt(botConfig.id, 10);
        if (PROTECTED_BOT_IDS.has(botId)) return true;
    }
    return false;
}

function isPasskeyValidForBot(botConfig, passkey) {
    if (botConfig && typeof botConfig.id !== 'undefined') {
        const botId = parseInt(botConfig.id, 10);
        const expected = PROTECTED_BOT_IDS.get(botId);
        if (expected) {
            return String(passkey || '').trim() === String(expected);
        }
    }
    return false;
}

function markPasskeyValidated(req, botId) {
    if (!botId || !req || !req.session) return;
    if (!req.session.botPasskeys) {
        req.session.botPasskeys = {};
    }
    req.session.botPasskeys[String(botId)] = true;
}

function isPasskeyValidated(req, botId) {
    if (!botId || !req || !req.session || !req.session.botPasskeys) return false;
    return req.session.botPasskeys[String(botId)] === true;
}

function clearPasskeyValidated(req, botId) {
    if (!botId || !req || !req.session || !req.session.botPasskeys) return;
    delete req.session.botPasskeys[String(botId)];
}

module.exports = {
    requiresPasskeyForBot,
    isPasskeyValidForBot,
    markPasskeyValidated,
    isPasskeyValidated,
    clearPasskeyValidated
};
