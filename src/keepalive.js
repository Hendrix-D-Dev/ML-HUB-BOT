const axios = require('axios');
const logger = require('./utils/logger');

class KeepAlive {
    constructor() {
        this.intervalId = null;
        this.secondaryIntervalId = null;
        this.httpIntervalId = null;
        this.healthCheckId = null;
        this.isRunning = false;
        this.consecutiveFailures = 0;
        this.maxFailures = 5;
        this.startTime = Date.now();
    }

    start() {
        if (this.isRunning) return;
        
        const localUrl = `http://localhost:${process.env.PORT || 3000}`;
        const externalUrl = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME || 'ml-hub-bot'}.onrender.com`;
        
        // Strategy 1: Every 2 minutes (aggressive)
        const primaryInterval = 2 * 60 * 1000;
        // Strategy 2: Every 5 minutes (staggered)
        const secondaryInterval = 5 * 60 * 1000;
        // Strategy 3: HTTP keep-alive every 1 minute
        const httpInterval = 1 * 60 * 1000;
        // Strategy 4: Health check every 30 seconds
        const healthInterval = 30 * 1000;
        
        logger.info(`🔄 Starting reinforced keep-alive service`);
        logger.info(`📍 Local URL: ${localUrl}`);
        logger.info(`📍 External URL: ${externalUrl}`);
        logger.info(`⏰ Primary ping every 2 minutes`);
        logger.info(`⏰ Secondary ping every 5 minutes`);
        logger.info(`⏰ HTTP keep-alive every 1 minute`);
        logger.info(`⏰ Health check every 30 seconds`);
        
        // Primary ping function (local)
        const primaryPing = async () => {
            try {
                const response = await axios.get(`${localUrl}/ping`, { timeout: 8000 });
                logger.info(`💓 Primary ping successful (${response.status})`);
                this.consecutiveFailures = 0;
                return true;
            } catch (error) {
                logger.error(`❌ Primary ping failed: ${error.message}`);
                this.consecutiveFailures++;
                
                if (this.consecutiveFailures >= 2) {
                    logger.warn(`⚠️ Multiple failures (${this.consecutiveFailures}), attempting external ping...`);
                    await this.externalPing(externalUrl);
                }
                
                if (this.consecutiveFailures >= this.maxFailures) {
                    logger.error(`❌ Too many failures (${this.consecutiveFailures}), restarting service...`);
                    this.restartService();
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
        
        // HTTP keep-alive with multiple endpoints
        const httpKeepAlive = async () => {
            try {
                const endpoints = ['/', '/health', '/ping', '/status'];
                let successCount = 0;
                for (const endpoint of endpoints) {
                    try {
                        await axios.get(`${localUrl}${endpoint}`, { timeout: 3000 });
                        successCount++;
                    } catch (e) {
                        // Silently fail individual endpoints
                    }
                }
                if (successCount > 0) {
                    logger.info(`🔗 HTTP keep-alive: ${successCount}/${endpoints.length} endpoints responded`);
                }
            } catch (error) {
                // Silently fail
            }
        };
        
        // Quick health check
        const healthCheck = async () => {
            try {
                const response = await axios.get(`${localUrl}/health`, { timeout: 3000 });
                if (response.status === 200) {
                    logger.debug(`🩺 Health check passed`);
                }
            } catch (error) {
                logger.warn(`⚠️ Health check failed: ${error.message}`);
            }
        };
        
        // Start all strategies
        primaryPing();
        httpKeepAlive();
        healthCheck();
        
        this.intervalId = setInterval(primaryPing, primaryInterval);
        this.secondaryIntervalId = setInterval(() => this.externalPing(externalUrl), secondaryInterval);
        this.httpIntervalId = setInterval(httpKeepAlive, httpInterval);
        this.healthCheckId = setInterval(healthCheck, healthInterval);
        this.isRunning = true;
        
        // Log stats every hour
        const statsLog = setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            logger.info(`📊 Keep-alive stats - Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m, Failures: ${this.consecutiveFailures}`);
        }, 60 * 60 * 1000);
        
        this.statsLogId = statsLog;
        
        logger.info('✅ Reinforced keep-alive service started successfully');
    }

    stop() {
        const intervals = [
            this.intervalId,
            this.secondaryIntervalId,
            this.httpIntervalId,
            this.healthCheckId,
            this.statsLogId
        ];
        
        intervals.forEach(id => {
            if (id) {
                clearInterval(id);
            }
        });
        
        this.intervalId = null;
        this.secondaryIntervalId = null;
        this.httpIntervalId = null;
        this.healthCheckId = null;
        this.statsLogId = null;
        this.isRunning = false;
        
        logger.info('🛑 Keep-alive service stopped');
    }

    restartService() {
        logger.warn('🔄 Restarting keep-alive service...');
        this.stop();
        setTimeout(() => {
            this.start();
            logger.info('✅ Keep-alive service restarted');
        }, 5000);
    }
}

module.exports = new KeepAlive();