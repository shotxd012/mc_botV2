const mongoose = require('mongoose');

const botMetricSchema = new mongoose.Schema({
    botId: {
        type: Number,
        required: true,
        index: true
    },
    health: {
        type: Number,
        default: 0
    },
    food: {
        type: Number,
        default: 0
    },
    cpu: {
        type: Number,
        default: 0
    },
    memory: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// TTL: auto-delete metric samples older than 7 days
botMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('BotMetric', botMetricSchema);
