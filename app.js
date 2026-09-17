require('dotenv').config();
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN || undefined, environment: process.env.NODE_ENV || 'development' });
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const dataManager = require('./utils/dataManager');
const botManager = require('./bot/BotManager');
const { connectDB, getMongoURI } = require('./utils/database');
const { MongoStore } = require('connect-mongo');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- Configuration ---
const PORT = process.env.PORT || 3010;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session
if (trustProxy) {
    // Needed when running behind a reverse proxy (e.g., Nginx, Render, Heroku)
    app.set('trust proxy', 1);
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required in every environment');
}

const sessionMiddleware = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: getMongoURI(),
        collectionName: 'sessions'
    }),
    cookie: {
        // Use auto so login works on HTTP while still enabling secure cookies on HTTPS.
        secure: isProduction ? 'auto' : false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// Make user available to all views
app.use(async (req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.settings = await dataManager.getSettings();
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
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const controlRoutes = require('./routes/control');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');
const legalRoutes = require('./routes/legal');

// Use Routes
app.use('/health', healthRoutes); // Public — no auth required
app.use('/', legalRoutes); // Public legal and data-rights pages
app.use('/', authRoutes);
app.use('/admin', requireAuth, adminRoutes);
app.use('/', requireAuth, dashboardRoutes);
app.use('/api', requireAuth, controlRoutes);

Sentry.setupExpressErrorHandler(app);
app.use((error, req, res, next) => {
    console.error('Unhandled Express error:', error);
    if (res.headersSent) return next(error);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// --- Socket.IO ---
io.use(async (socket, next) => {
    try {
        const user = socket.request.session?.user;
        if (!user) return next(new Error('Authentication required'));
        const admin = await dataManager.getAdmin(user.username);
        if (!admin) return next(new Error('Authentication required'));
        const bots = admin.role === 'admin' ? await dataManager.getBots() : await dataManager.getBotsByUser(admin.username);
        socket.allowedBotIds = new Set(bots.map(bot => String(bot.id)));
        next();
    } catch (error) { Sentry.captureException(error); next(new Error('Authentication failed')); }
});

io.on('connection', (socket) => {
    const statuses = botManager.getAllBotsStatus().filter(status => socket.allowedBotIds.has(String(status.id)));
    statuses.forEach(status => socket.join(`bot:${status.id}`));
    socket.emit('bot-list', statuses);

    socket.on('get-status', (botId) => {
        if (!socket.allowedBotIds.has(String(botId))) return;
        const status = botManager.getStatus(botId);
        if (status) {
            socket.emit('status', { botId, status });
        }
    });

    socket.on('disconnect', () => {
        // console.log('Client disconnected');
    });
});



// --- Start Server ---
async function startServer() {
    try {
        await connectDB();
        
        server.listen(PORT, async () => {
            console.log(`Server running on http://localhost:${PORT}`);
            
            // Initialize Bot Manager after server is listening
            try {
                await botManager.init(io);
                app.set('io', io);
            } catch (initError) {
                console.error('Failed to initialize Bot Manager:', initError);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

process.on('uncaughtException', error => { console.error('Uncaught exception:', error); Sentry.captureException(error); });
process.on('unhandledRejection', reason => { console.error('Unhandled rejection:', reason); Sentry.captureException(reason); });

module.exports = { app, server, io };
