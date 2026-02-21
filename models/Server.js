const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    ip: {
        type: String,
        required: true
    },
    port: {
        type: Number,
        required: true,
        default: 25565
    },
    version: {
        type: String,
        required: true,
        default: '1.20.4'
    },
    maxBots: {
        type: Number,
        default: 0
    },
    region: {
        type: String,
        default: ''
    },
    whitelist: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Server', serverSchema);
