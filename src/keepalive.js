const axios = require('axios');
const logger = require('./utils/logger');

class KeepAlive {
    constructor() {
        this.intervalId = null;
        this.secondaryIntervalId = null;
        this.httpIntervalId = null;
        this.isRunning = false;
        this.consecutiveFailures = 0;
    }

    start() {
        if (this.isRunning) return;
        
        const localUrl = `http://localhost:${process.env.PORT || 3000}`;
        const externalUrl = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME || 'ml-hub-bot'}.onrender.com`;
        
        // Strategy 1: Every 4 minutes (more aggressive)
        const primaryInterval = 4 * 60 * 1000; // 4 minutes
        // Strategy 2: Every 7 minutes (staggered)
        const secondaryInterval = 7 * 60 * 1000; // 7 minutes
        // Strategy 3: HTTP keep-alive every 2 minutes
        const httpInterval = 2 * 60 * 1000; // 2 minutes
        
        logger.info(`🔄 Starting enhanced keep-alive service`);
        logger.info(`📍 Local URL: ${localUrl}`);
        logger.info(`📍 External URL: ${externalUrl}`);
        logger.info(`⏰ Primary ping every 4 minutes`);
        logger.info(`⏰ Secondary ping every 7 minutes`);
        logger.info(`⏰ HTTP keep-alive every 2 minutes`);
        
        // Primary ping function (local)
        const primaryPing = async () => {
            try {
                const response = await axios.get(`${localUrl}/ping`, { timeout: 10000 });
                logger.info(`💓 Primary ping successful (${response.status})`);
                this.consecutiveFailures = 0;
                return true;
            } catch (error) {
                logger.error(`❌ Primary ping failed: ${error.message}`);
                this.consecutiveFailures++;
                
                if (this.consecutiveFailures >= 2) {
                    logger.warn(`⚠️ Multiple failures, attempting external ping...`);
                    await this.externalPing(externalUrl);
                }
                return false;
            }
        };
        
        // External ping function
        this.externalPing = async (url) => {
            try {
                const response = await axios.get(`${url}/ping`, { timeout: 15000 });
                logger.info(`🌐 External ping successful (${response.status})`);
                return true;
            } catch (error) {
                logger.error(`❌ External ping failed: ${error.message}`);
                return false;
            }
        };
        
        // HTTP keep-alive
        const httpKeepAlive = async () => {
            try {
                const endpoints = ['/', '/health', '/ping', '/status'];
                for (const endpoint of endpoints) {
                    await axios.get(`${localUrl}${endpoint}`, { timeout: 5000 }).catch(() => {});
                }
                logger.info(`🔗 HTTP keep-alive cycle completed`);
            } catch (error) {}
        };
        
        // Start all strategies
        primaryPing();
        httpKeepAlive();
        
        this.intervalId = setInterval(primaryPing, primaryInterval);
        this.secondaryIntervalId = setInterval(() => this.externalPing(externalUrl), secondaryInterval);
        this.httpIntervalId = setInterval(httpKeepAlive, httpInterval);
        this.isRunning = true;
        
        logger.info('✅ Enhanced keep-alive service started successfully');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.secondaryIntervalId) {
            clearInterval(this.secondaryIntervalId);
            this.secondaryIntervalId = null;
        }
        if (this.httpIntervalId) {
            clearInterval(this.httpIntervalId);
            this.httpIntervalId = null;
        }
        this.isRunning = false;
        logger.info('🛑 Keep-alive service stopped');
    }
}

module.exports = new KeepAlive();