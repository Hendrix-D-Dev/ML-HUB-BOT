/**
 * Livestream Manager Service
 * Orchestrates the YouTube monitoring and notification system
 * Optimized for prime time checking (night streams)
 */
const YouTubeService = require('./youtube');
const NotificationService = require('./notification');
const featureManager = require('./featureManager');
const logger = require('../utils/logger');

class LivestreamManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.youtubeService = new YouTubeService(
            config.youtube.apiKey,
            config.youtube.channelId
        );
        this.notificationService = client.notificationService || new NotificationService(client);
        this.isRunning = false;
        this.checkInterval = null;
        this.primeInterval = null;
        this.lastCheckTime = null;
        this.totalChecks = 0;
        this.successfulChecks = 0;
        this.notificationsSent = 0;
        this.lastLiveStreamId = null;
        this.isPrimeTime = false;
    }

    /**
     * Check if current time is within prime time hours
     */
    isInPrimeTime() {
        const now = new Date();
        const hour = now.getHours();
        const primeStart = this.config.youtube.primeStart || 20; // 8pm default
        const primeEnd = this.config.youtube.primeEnd || 23; // 11pm default
        
        // Handle overnight prime time (e.g., 20:00 - 02:00)
        if (primeStart < primeEnd) {
            return hour >= primeStart && hour < primeEnd;
        } else {
            return hour >= primeStart || hour < primeEnd;
        }
    }

    /**
     * Get the appropriate check interval based on time of day
     */
    getCheckInterval() {
        const isPrime = this.isInPrimeTime();
        this.isPrimeTime = isPrime;
        
        if (isPrime) {
            const interval = this.config.youtube.primeInterval || 300000; // 5 minutes default
            logger.debug(`⏰ Prime time active - checking every ${interval / 60000} minutes`);
            return interval;
        } else {
            const interval = this.config.youtube.checkInterval || 3600000; // 1 hour default
            logger.debug(`⏰ Non-prime time - checking every ${interval / 60000} minutes`);
            return interval;
        }
    }

    /**
     * Start the livestream monitoring service
     * @param {number} intervalMs - Check interval in milliseconds (optional, uses config)
     * @returns {boolean} - Success status
     */
    start(intervalMs) {
        if (this.isRunning) {
            logger.warn('⚠️ Livestream manager is already running');
            return false;
        }

        // Validate configuration
        if (!this.config.youtube.apiKey) {
            logger.error('❌ YouTube API key not configured. Set YOUTUBE_API_KEY in .env');
            return false;
        }

        if (!this.config.youtube.channelId) {
            logger.error('❌ YouTube channel ID not configured. Set YOUTUBE_CHANNEL_ID in .env');
            return false;
        }

        if (!this.config.youtube.notificationChannelId) {
            logger.error('❌ Notification channel ID not configured. Set YOUTUBE_NOTIFICATION_CHANNEL_ID in .env');
            return false;
        }

        // Check if livestream notifications feature is enabled
        if (!featureManager.isEnabled('livestreamNotifications')) {
            logger.warn('⚠️ Livestream notifications are disabled. Feature will not run.');
            logger.info('ℹ️ Enable with: /admin features enable livestreamNotifications');
            return false;
        }

        const checkInterval = intervalMs || this.getCheckInterval();
        const primeInfo = this.isInPrimeTime() ? 'ACTIVE' : 'INACTIVE';

        logger.info(`🎥 Starting YouTube Livestream Manager (Prime Time Optimized)`);
        logger.info(`📺 Monitoring channel: ${this.config.youtube.channelId}`);
        logger.info(`💬 Notifications will be sent to: ${this.config.youtube.notificationChannelId}`);
        logger.info(`⏰ Prime Time (8pm-11pm): ${primeInfo}`);
        logger.info(`⏰ Check interval: ${checkInterval / 60000} minutes`);

        // Do initial check immediately
        this.checkStream();

        // Set up the main interval
        this.checkInterval = setInterval(() => {
            this.checkStream();
        }, checkInterval);

        // Set up a separate interval to check if we've entered prime time
        this.primeInterval = setInterval(() => {
            const newInterval = this.getCheckInterval();
            const currentInterval = this.checkInterval._idleTimeout || 0;
            
            // If interval changed, reset it
            if (Math.abs(newInterval - currentInterval) > 10000) {
                logger.info(`⏰ Check interval updated: ${newInterval / 60000} minutes ${this.isPrimeTime ? '(Prime Time)' : '(Off Peak)'}`);
                
                // Clear existing interval
                clearInterval(this.checkInterval);
                
                // Set up new interval
                this.checkInterval = setInterval(() => {
                    this.checkStream();
                }, newInterval);
            }
        }, 60000); // Check prime time status every minute

        this.isRunning = true;
        logger.info('✅ Livestream manager started successfully');
        return true;
    }

    /**
     * Stop the livestream monitoring service
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.primeInterval) {
            clearInterval(this.primeInterval);
            this.primeInterval = null;
        }
        this.isRunning = false;
        logger.info('🛑 Livestream manager stopped');
    }

    /**
     * Perform a single check of the YouTube channel
     */
    async checkStream() {
        // Check if livestream notifications feature is enabled
        if (!featureManager.isEnabled('livestreamNotifications')) {
            if (this.isRunning) {
                logger.info('ℹ️ Livestream notifications disabled. Stopping manager...');
                this.stop();
            }
            return;
        }

        this.totalChecks++;
        this.lastCheckTime = new Date().toISOString();
        const isPrime = this.isInPrimeTime();

        try {
            logger.info(`🔍 Checking YouTube channel... (Check #${this.totalChecks}) ${isPrime ? '🔴 Prime Time' : '⚪ Off Peak'}`);

            const streamData = await this.youtubeService.checkLiveStatus();

            if (streamData) {
                // New livestream detected! Send notification
                logger.info(`🔴 New livestream detected!`);
                logger.info(`📺 Title: ${streamData.title}`);
                logger.info(`🔗 URL: ${streamData.url}`);

                // Check if polls feature is enabled
                const pollsEnabled = featureManager.isEnabled('polls');
                logger.info(`📊 Polls feature: ${pollsEnabled ? 'ENABLED' : 'DISABLED'}`);

                // Send notification
                const result = await this.notificationService.sendLivestreamNotification(
                    streamData,
                    this.config.youtube.notificationChannelId,
                    true // @everyone
                );

                if (result.success) {
                    this.notificationsSent++;
                    this.lastLiveStreamId = streamData.videoId;
                    logger.info(`✅ Notification sent for livestream: ${streamData.videoId}`);
                    if (pollsEnabled) {
                        logger.info(`📊 Poll created for match prediction`);
                    } else {
                        logger.info(`ℹ️ Polls disabled - no poll created`);
                    }
                } else {
                    logger.error(`❌ Failed to send notification: ${result.error}`);
                }
            }

            this.successfulChecks++;

        } catch (error) {
            logger.error(`❌ Error during stream check: ${error.message}`);
            // Don't increment successfulChecks on error
        }
    }

    /**
     * Force a manual check (useful for testing)
     */
    async forceCheck() {
        logger.info('🔄 Force checking YouTube channel...');
        await this.checkStream();
        return this.youtubeService.getStatus();
    }

    /**
     * Send a test notification to verify configuration
     */
    async sendTestNotification() {
        if (!featureManager.isEnabled('livestreamNotifications')) {
            logger.warn('⚠️ Livestream notifications are disabled. Enable with: /admin features enable livestreamNotifications');
            return false;
        }
        
        return await this.notificationService.sendTestNotification(
            this.config.youtube.notificationChannelId
        );
    }

    /**
     * Get service statistics
     * @returns {Object} - Stats
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            isPrimeTime: this.isPrimeTime,
            totalChecks: this.totalChecks,
            successfulChecks: this.successfulChecks,
            notificationsSent: this.notificationsSent,
            lastCheckTime: this.lastCheckTime,
            lastLiveStreamId: this.lastLiveStreamId,
            currentStatus: this.youtubeService.getStatus(),
            hasActivePoll: this.client.activePolls ? 
                Object.keys(this.client.activePolls).length > 0 : false,
            pollsEnabled: featureManager.isEnabled('polls'),
            quotaStats: this.youtubeService.getQuotaStats ? this.youtubeService.getQuotaStats() : null
        };
    }

    /**
     * Reset the state (clears last stream ID)
     */
    resetState() {
        this.youtubeService.resetState();
        this.lastLiveStreamId = null;
        // Clear active polls
        if (this.client.activePolls) {
            this.client.activePolls = {};
        }
        logger.info('🔄 Livestream manager state reset');
    }
}

module.exports = LivestreamManager;