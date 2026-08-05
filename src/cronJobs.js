const logger = require('./utils/logger');

class CronJobs {
    constructor(client) {
        this.client = client;
        this.intervals = [];
        this.startTime = Date.now();
    }

    start() {
        logger.info('⏰ Starting cron jobs...');
        
        // Job 1: Update bot status every 15 minutes (more frequent)
        const statusInterval = setInterval(() => {
            if (this.client && this.client.user) {
                const activities = [
                    { name: 'Mobile Legends | /help', type: 3 },
                    { name: `${this.client.guilds.cache.size} servers`, type: 3 },
                    { name: 'MLBB Tournaments', type: 3 },
                    { name: 'Ranked Matches', type: 3 },
                    { name: 'YouTube Live Notifications', type: 3 },
                    { name: '🎮 ML HUB BOT', type: 3 }
                ];
                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                this.client.user.setPresence({
                    activities: [randomActivity],
                    status: 'online'
                });
                logger.debug(`🔄 Bot status updated: ${randomActivity.name}`);
            }
        }, 15 * 60 * 1000); // Every 15 minutes
        
        // Job 2: Log uptime every 6 hours
        const uptimeInterval = setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            logger.info(`📊 Bot uptime: ${days}d ${hours}h ${minutes}m`);
        }, 6 * 60 * 60 * 1000);
        
        // Job 3: Memory cleanup check every hour
        const memoryInterval = setInterval(() => {
            const memory = process.memoryUsage();
            const usedMB = Math.round(memory.heapUsed / 1024 / 1024);
            const maxMB = Math.round(memory.heapTotal / 1024 / 1024);
            logger.debug(`💾 Memory usage: ${usedMB}MB / ${maxMB}MB`);
        }, 60 * 60 * 1000);
        
        this.intervals.push(statusInterval, uptimeInterval, memoryInterval);
        logger.info('✅ Cron jobs started successfully');
    }

    stop() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        logger.info('🛑 Cron jobs stopped');
    }
}

module.exports = CronJobs;