const express = require('express');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Create a simple HTTP server
app.get('/', (req, res) => {
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
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: 'ML HUB BOT'
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
});

// Add a status endpoint with more details
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Start the server
const server = app.listen(PORT, () => {
    logger.info(`🌐 Ping server running on port ${PORT}`);
    logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
});

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