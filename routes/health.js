const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

/**
 * GET /health
 * Public health check endpoint for monitoring tools
 */
router.get('/', async (req, res) => {
    const dbState = mongoose.connection?.readyState ?? 0;
    res.json({
        status: dbState === 1 ? 'ok' : 'degraded'
    });
});

module.exports = router;
