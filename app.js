const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const dataManager = require('./utils/dataManager');
const botManager = require('./bot/BotManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- Configuration ---
const PORT = process.env.PORT || 3010;

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'mc-bot-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.settings = dataManager.getSettings();
    next();
});

// --- Authentication Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- Routes ---
// Import routes (we will implement these files fully in later steps)
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const controlRoutes = require('./routes/control');

// Use Routes
app.use('/', authRoutes);
app.use('/', requireAuth, dashboardRoutes);
app.use('/api', requireAuth, controlRoutes);

// --- Socket.IO ---
io.on('connection', (socket) => {
    // Send list of bots on connect
    socket.emit('bot-list', botManager.getAllBotsStatus());

    socket.on('get-status', (botId) => {
        const status = botManager.getStatus(botId);
        if (status) {
            socket.emit('status', { botId, status });
        }
    });

    socket.on('disconnect', () => {
        // console.log('Client disconnected');
    });
});

// Initialize Bot Manager
botManager.init(io);
app.set('io', io);

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
