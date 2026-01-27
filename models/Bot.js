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
    }
});

module.exports = mongoose.model('Bot', botSchema);