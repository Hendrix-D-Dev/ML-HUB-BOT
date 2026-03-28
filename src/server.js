const express = require('express');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Add request logging middleware
app.use((req, res, next) => {
    logger.http(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Create a simple HTTP server
app.get('/', (req, res) => {
    logger.info('Health check received at /');
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: 'ML HUB BOT is running',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    logger.info('Health check received at /health');
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: 'ML HUB BOT',
        memory: process.memoryUsage()
    });
});

app.get('/ping', (req, res) => {
    logger.info('Ping received');
    res.status(200).send('Pong!');
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        node_version: process.version,
        platform: process.platform
    });
});

// Start the server
const server = app.listen(PORT, () => {
    logger.info(`🌐 Ping server running on port ${PORT}`);
    logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
    logger.info(`📊 Status check available at: http://localhost:${PORT}/status`);
});

// Self-ping function to keep the bot alive on Render free tier
function selfPing() {
    const url = `http://localhost:${PORT}/ping`;
    
    fetch(url)
        .then(response => {
            logger.info(`🔄 Self-ping successful: ${response.status}`);
        })
        .catch(error => {
            logger.error(`❌ Self-ping failed: ${error.message}`);
        });
}

// Ping every 10 minutes (Render free tier sleeps after 15 minutes of inactivity)
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Start self-pinging
if (process.env.NODE_ENV === 'production') {
    logger.info('🔄 Starting self-ping system to prevent sleep...');
    selfPing(); // Ping immediately on startup
    setInterval(selfPing, PING_INTERVAL);
    logger.info(`✅ Self-ping will run every ${PING_INTERVAL / 60000} minutes`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
});

module.exports = app;