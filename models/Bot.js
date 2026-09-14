const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    server: {
        ip: {
            type: String,
            default: 'localhost'
        },
        port: {
            type: Number,
            default: 25565
        },
        version: {
            type: String,
            default: '1.20.4'
        }
    },
    serverProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Server',
        default: null
    },
    account: {
        email: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            default: 'microsoft'
        },
        verified: {
            type: Boolean,
            default: false
        },
        authCache: {
            type: Object,
            default: null
        }
    },
    created: {
        type: Date,
        default: Date.now
    },
    assignedTo: {
        type: String, // Username of the user assigned to this bot
        ref: 'Admin',
        default: null // Initially not assigned to any user
    },
    // AFK & Automation
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
    // Notifications
    webhookUrl: {
        type: String,
        default: ''
    },
    // On-spawn command queue
    loginCommands: {
        type: [String],
        default: []
    },
    // Meta
    notes: {
        type: String,
        default: ''
    },
    // Accumulated uptime in seconds across all sessions
    totalUptime: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Bot', botSchema);
