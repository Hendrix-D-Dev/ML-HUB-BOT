const axios = require('axios');
const logger = require('./utils/logger');

class KeepAlive {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        
        const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
        const pingInterval = 8 * 60 * 1000; // 8 minutes (less than Render's 15 minute sleep)
        
        logger.info(`🔄 Starting keep-alive service for ${url}`);
        logger.info(`⏰ Will ping every ${pingInterval / 60000} minutes`);
        
        // Ping function
        const ping = async () => {
            try {
                const response = await axios.get(`${url}/ping`, { timeout: 10000 });
                logger.info(`💓 Keep-alive ping successful at ${new Date().toISOString()}`);
                return true;
            } catch (error) {
                logger.error(`❌ Keep-alive ping failed: ${error.message}`);
                return false;
            }
        };
        
        // Ping immediately
        ping();
        
        // Set interval
        this.intervalId = setInterval(ping, pingInterval);
        this.isRunning = true;
        
        // Log every hour that the keep-alive is running
        const hourlyLog = setInterval(() => {
            logger.info('💓 Keep-alive service is active');
        }, 60 * 60 * 1000);
        
        // Store hourly log interval to clean up later
        this.hourlyLogId = hourlyLog;
        
        logger.info('✅ Keep-alive service started successfully');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            logger.info('🛑 Keep-alive service stopped');
        }
        if (this.hourlyLogId) {
            clearInterval(this.hourlyLogId);
            this.hourlyLogId = null;
        }
    }
}

module.exports = new KeepAlive();