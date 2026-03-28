const express = require('express');
const axios = require('axios');
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
async function selfPing() {
    const url = `http://localhost:${PORT}/ping`;
    
    try {
        const response = await axios.get(url, { timeout: 5000 });
        logger.info(`🔄 Self-ping successful at ${new Date().toISOString()} - Status: ${response.status}`);
    } catch (error) {
        logger.error(`❌ Self-ping failed: ${error.message}`);
    }
}

// Ping every 10 minutes (Render free tier sleeps after 15 minutes of inactivity)
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Start self-pinging only in production
if (process.env.NODE_ENV === 'production') {
    logger.info('🔄 Starting self-ping system to prevent sleep...');
    logger.info(`⏰ Will ping every ${PING_INTERVAL / 60000} minutes`);
    
    // Ping immediately on startup
    selfPing();
    
    // Set up interval
    const intervalId = setInterval(selfPing, PING_INTERVAL);
    
    // Log that interval is running
    logger.info(`✅ Self-ping interval started with ID: ${intervalId}`);
    
    // Optional: Log every hour that the ping system is alive
    setInterval(() => {
        logger.info('💓 Self-ping system is alive and running');
    }, 60 * 60 * 1000);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;