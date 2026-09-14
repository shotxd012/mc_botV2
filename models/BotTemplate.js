const mongoose = require('mongoose');

const botTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    server: {
        ip: { type: String, default: 'localhost' },
        port: { type: Number, default: 25565 },
        version: { type: String, default: '1.20.4' }
    },
    account: {
        email: { type: String, default: '' }
    },
    afkProfile: {
        type: String,
        enum: ['random_look', 'circle_walk', 'jump_spam', 'spin'],
        default: 'random_look'
    },
    autoEat: {
        type: Boolean,
        default: true
    },
    autoStart: {
        type: Boolean,
        default: false
    },
    loginCommands: {
        type: [String],
        default: []
    },
    notes: {
        type: String,
        default: ''
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BotTemplate', botTemplateSchema);
