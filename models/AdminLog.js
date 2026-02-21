const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
    actor: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    target: {
        type: String,
        default: ''
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AdminLog', adminLogSchema);
