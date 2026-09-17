# AGENTS.md

## Project Overview

This is a Minecraft AFK Bot Admin Dashboard - a web-based application that controls and monitors Minecraft AFK bots using Mineflayer. The application allows users to manage multiple Minecraft bots with features like start/stop control, AFK mode, live console, and server configuration.

## Architecture

- **Backend**: Node.js with Express.js framework
- **Bot Framework**: Mineflayer for Minecraft bot automation
- **Frontend**: EJS templates with Tailwind CSS (via CDN)
- **Real-time Communication**: Socket.IO
- **Authentication**: express-session with bcrypt for local authentication
- **Data Storage**: MongoDB for application data and runtime records

## Key Components

### Core Files
- `app.js`: Main application entry point, sets up Express server, middleware, routes, and Socket.IO
- `bot/BotManager.js`: Manages multiple bot instances, provides CRUD operations for bots
- `bot/BotInstance.js`: Represents individual bot instances with connection, AFK, and control logic
- `utils/dataManager.js`: Handles data persistence using local JSON file
- `routes/`: Contains route handlers for authentication, dashboard, and control APIs

### Data Flow
- User credentials, bot configurations, server profiles, settings, logs, events, and metrics stored in MongoDB
- Socket.IO provides real-time status updates and console logs
- Multiple bot instances can run simultaneously managed by BotManager

## Development Commands

### Basic Operations
```bash
# Install dependencies
npm install

# Start the application (runs on port 3010 by default)
npm start

# Change port (default is 3010)
PORT=3000 npm start
```

### Testing
```bash
# The project has no automated tests defined in package.json
# Manual testing required for functionality verification
```

## Security Considerations

- Default login credentials: username `root`, password `REDACTED_DEFAULT_PASSWORD`
- Session-based authentication using express-session
- Passwords stored as bcrypt hashes in data.json
- Microsoft authentication flow for Minecraft accounts

## Configuration

- Server settings (IP, port, version) stored per bot in MongoDB
- Microsoft authentication profiles use the OS temporary directory at `mc-bot-auth-cache/bot-{botId}` because Mineflayer requires a filesystem profile directory
- Global settings include auto-reconnect and dark mode preferences
- Console history stored in MongoDB `BotLog` documents

## Additional Features

- Console history: Preserves logs between sessions with configurable limits
- AFK status indicator: Visual indication of AFK state on the control panel
- Enhanced delete protection: Confirmation dialog with bot name to prevent accidental deletion
