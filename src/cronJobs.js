const logger = require('./utils/logger');

class CronJobs {
    constructor(client) {
        this.client = client;
        this.intervals = [];
    }

    start() {
        logger.info('⏰ Starting cron jobs...');
        
        // Job 1: Update bot status every 30 minutes
        const statusInterval = setInterval(() => {
            if (this.client && this.client.user) {
                const activities = [
                    { name: 'Mobile Legends | /help', type: 3 },
                    { name: `${this.client.guilds.cache.size} servers`, type: 3 },
                    { name: 'MLBB Tournaments', type: 3 },
                    { name: 'Ranked Matches', type: 3 }
                ];
                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                this.client.user.setPresence({
                    activities: [randomActivity],
                    status: 'online'
                });
                logger.info(`🔄 Bot status updated: ${randomActivity.name}`);
            }
        }, 30 * 60 * 1000);
        
        this.intervals.push(statusInterval);
        logger.info('✅ Cron jobs started successfully');
    }

    stop() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        logger.info('🛑 Cron jobs stopped');
    }
}

module.exports = CronJobs;