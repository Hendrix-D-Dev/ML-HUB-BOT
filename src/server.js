const express = require('express');
const axios = require('axios');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Add keep-alive headers to all responses
app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    next();
});

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

// Active connections counter
let activeConnections = 0;
app.use((req, res, next) => {
    activeConnections++;
    res.on('finish', () => activeConnections--);
    next();
});

app.get('/connections', (req, res) => {
    res.json({ activeConnections });
});

// Start the server with keep-alive options
const server = app.listen(PORT, () => {
    logger.info(`🌐 Ping server running on port ${PORT}`);
    logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
    logger.info(`📊 Status check available at: http://localhost:${PORT}/status`);
    logger.info(`🔌 Server configured with keep-alive`);
});

// Increase server timeout to prevent disconnections
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Aggressive self-ping function
async function selfPing() {
    const localUrl = `http://localhost:${PORT}/ping`;
    
    try {
        const response = await axios.get(localUrl, { timeout: 5000 });
        logger.info(`🔄 Self-ping successful at ${new Date().toISOString()}`);
        return true;
    } catch (error) {
        logger.error(`❌ Self-ping failed: ${error.message}`);
        return false;
    }
}

// Aggressive self-pinging (every 2 minutes instead of 10)
if (process.env.NODE_ENV === 'production') {
    logger.info('🔄 Starting aggressive self-ping system...');
    selfPing(); // Immediate ping
    setInterval(selfPing, 2 * 60 * 1000); // Every 2 minutes
    logger.info('✅ Aggressive self-ping active (every 2 minutes)');
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