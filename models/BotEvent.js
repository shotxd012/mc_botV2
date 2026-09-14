const mongoose = require('mongoose');

const botEventSchema = new mongoose.Schema({
    botId: {
        type: Number,
        required: true,
        index: true
    },
    event: {
        type: String,
        enum: ['login', 'kicked', 'disconnect', 'reconnect', 'afk_start', 'afk_stop', 'spawn', 'error'],
        required: true
    },
    details: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// TTL: auto-delete events older than 30 days
botEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('BotEvent', botEventSchema);
