const express = require('express');
const axios = require('axios');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Add keep-alive headers to all responses
app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=10, max=1000');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
        memory: process.memoryUsage(),
        activeConnections: activeConnections || 0
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
    res.json({ 
        activeConnections,
        totalRequests: totalRequests || 0
    });
});

// Request counter
let totalRequests = 0;
app.use((req, res, next) => {
    totalRequests++;
    next();
});

// Start the server with keep-alive options
const server = app.listen(PORT, () => {
    logger.info(`🌐 Ping server running on port ${PORT}`);
    logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
    logger.info(`📊 Status check available at: http://localhost:${PORT}/status`);
    logger.info(`🔌 Server configured with keep-alive timeout: 10s`);
});

// Increase server timeout to prevent disconnections
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 121000; // 121 seconds
server.timeout = 120000; // 120 seconds

// Aggressive self-ping with multiple endpoints
async function aggressiveSelfPing() {
    const localUrl = `http://localhost:${PORT}`;
    const endpoints = ['/ping', '/health', '/status', '/'];
    let successCount = 0;
    
    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`${localUrl}${endpoint}`, { timeout: 3000 });
            if (response.status === 200 || response.status === 304) {
                successCount++;
            }
        } catch (error) {
            // Silent fail
        }
    }
    
    if (successCount > 0) {
        logger.info(`🔄 Aggressive ping cycle: ${successCount}/${endpoints.length} endpoints responded`);
    } else {
        logger.warn('⚠️ All ping endpoints failed');
    }
}

// Aggressive self-pinging (every 60 seconds instead of 2 minutes)
if (process.env.NODE_ENV === 'production') {
    logger.info('🔄 Starting aggressive self-ping system...');
    aggressiveSelfPing(); // Immediate ping
    setInterval(aggressiveSelfPing, 60 * 1000); // Every 60 seconds
    logger.info('✅ Aggressive self-ping active (every 60 seconds)');
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