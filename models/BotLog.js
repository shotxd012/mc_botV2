const mongoose = require('mongoose');

const botLogSchema = new mongoose.Schema({
    botId: {
        type: Number,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'error', 'chat', 'action', 'output'],
        default: 'info'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BotLog', botLogSchema);
