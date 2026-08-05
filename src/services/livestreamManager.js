/**
 * Livestream Manager Service
 * Orchestrates the YouTube monitoring and notification system
 */
const YouTubeService = require('./youtube');
const NotificationService = require('./notification');
const logger = require('../utils/logger');

class LivestreamManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.youtubeService = new YouTubeService(
            config.youtube.apiKey,
            config.youtube.channelId
        );
        this.notificationService = new NotificationService(client);
        this.isRunning = false;
        this.checkInterval = null;
        this.lastCheckTime = null;
        this.totalChecks = 0;
        this.successfulChecks = 0;
        this.notificationsSent = 0;
        this.lastLiveStreamId = null;
    }

    /**
     * Start the livestream monitoring service
     * @param {number} intervalMs - Check interval in milliseconds
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

        const checkInterval = intervalMs || this.config.youtube.checkInterval || 180000;

        logger.info(`🎥 Starting YouTube Livestream Manager`);
        logger.info(`📺 Monitoring channel: ${this.config.youtube.channelId}`);
        logger.info(`💬 Notifications will be sent to: ${this.config.youtube.notificationChannelId}`);
        logger.info(`⏰ Checking every ${checkInterval / 60000} minutes`);

        // Do initial check immediately
        this.checkStream();

        // Set up interval
        this.checkInterval = setInterval(() => {
            this.checkStream();
        }, checkInterval);

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
        this.isRunning = false;
        logger.info('🛑 Livestream manager stopped');
    }

    /**
     * Perform a single check of the YouTube channel
     */
    async checkStream() {
        this.totalChecks++;
        this.lastCheckTime = new Date().toISOString();

        try {
            logger.info(`🔍 Checking YouTube channel... (Check #${this.totalChecks})`);

            const streamData = await this.youtubeService.checkLiveStatus();

            if (streamData) {
                // New livestream detected! Send notification with poll
                logger.info(`🔴 New livestream detected!`);
                logger.info(`📺 Title: ${streamData.title}`);
                logger.info(`🔗 URL: ${streamData.url}`);

                // Send notification with poll
                const result = await this.notificationService.sendLivestreamNotification(
                    streamData,
                    this.config.youtube.notificationChannelId,
                    true // @everyone
                );

                if (result.success) {
                    this.notificationsSent++;
                    this.lastLiveStreamId = streamData.videoId;
                    logger.info(`✅ Notification sent for livestream: ${streamData.videoId}`);
                    logger.info(`📊 Poll created for match prediction`);
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
            totalChecks: this.totalChecks,
            successfulChecks: this.successfulChecks,
            notificationsSent: this.notificationsSent,
            lastCheckTime: this.lastCheckTime,
            lastLiveStreamId: this.lastLiveStreamId,
            currentStatus: this.youtubeService.getStatus(),
            hasActivePoll: this.notificationService.client.activePolls ? 
                Object.keys(this.notificationService.client.activePolls).length > 0 : false
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