/**
 * Livestream Manager Service
 * FOCUSED PRIME TIME MODE - Only active during 8pm-12am
 * Checks every 10 seconds during prime time for INSTANT detection
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
        this.isPrimeTime = false;
        this.isSleepMode = false;
        this.totalChecks = 0;
        this.primeChecks = 0;
        this.notificationsSent = 0;
        this.lastCheckTime = null;
        this.lastLiveStreamId = null;
        this.checkedToday = false;
        this.todayDate = null;
    }

    /**
     * Check if current time is within prime time hours (8pm-12am)
     */
    isInPrimeTime() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour + minute / 60;
        
        const primeStart = this.config.youtube.primeStart || 20; // 8pm
        const primeEnd = this.config.youtube.primeEnd || 0; // 12am
        
        if (primeStart < primeEnd) {
            return currentTime >= primeStart && currentTime < primeEnd;
        } else {
            return currentTime >= primeStart || currentTime < primeEnd;
        }
    }

    /**
     * Get the appropriate check interval based on time of day
     */
    getCheckInterval() {
        const isPrime = this.isInPrimeTime();
        this.isPrimeTime = isPrime;
        
        if (isPrime) {
            const interval = this.config.youtube.primeInterval || 10000; // 10 seconds
            return interval;
        } else {
            // Sleep mode - use a long interval (no checks needed)
            const interval = this.config.youtube.checkInterval || 1800000; // 30 minutes
            return interval;
        }
    }

    /**
     * Start the livestream monitoring service
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

        if (!featureManager.isEnabled('livestreamNotifications')) {
            logger.warn('⚠️ Livestream notifications are disabled. Enable with: /admin features enable livestreamNotifications');
            return false;
        }

        const isPrime = this.isInPrimeTime();
        const checkInterval = this.getCheckInterval();

        logger.info(`🎥 Starting YouTube Livestream Manager (FOCUSED PRIME TIME MODE)`);
        logger.info(`📺 Monitoring channel: ${this.config.youtube.channelId}`);
        logger.info(`💬 Notifications: ${this.config.youtube.notificationChannelId}`);
        logger.info(`⏰ Prime Time (8pm-12am): ${isPrime ? '🟢 ACTIVE' : '⚪ SLEEPING'}`);
        logger.info(`⏰ Check interval: ${isPrime ? `${checkInterval / 1000} SECONDS` : `${checkInterval / 60000} minutes (sleep mode)`}`);
        
        if (isPrime) {
            logger.info(`🔴 INSTANT DETECTION MODE ENABLED - Checking every ${checkInterval / 1000} seconds`);
        } else {
            logger.info(`💤 Sleep mode active - No checks until 8pm`);
        }

        // Do an initial check immediately
        this.checkStream();

        // Set up the main interval
        this.checkInterval = setInterval(() => {
            this.checkStream();
        }, checkInterval);

        // Check prime time status every 5 seconds for instant switching
        this.primeInterval = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const isPrime = this.isInPrimeTime();
            
            // If prime time status changed
            if (this.isPrimeTime !== isPrime) {
                this.isPrimeTime = isPrime;
                const newInterval = this.getCheckInterval();
                
                if (isPrime) {
                    logger.info(`🔴🔴🔴 PRIME TIME STARTED (8pm) - Switching to INSTANT DETECTION MODE!`);
                    logger.info(`⏰ Now checking every ${newInterval / 1000} seconds`);
                } else {
                    logger.info(`💤💤💤 PRIME TIME ENDED (12am) - Switching to SLEEP MODE`);
                    logger.info(`⏰ No checks until 8pm tomorrow`);
                }
                
                // Clear and restart interval with new timing
                clearInterval(this.checkInterval);
                this.checkInterval = setInterval(() => {
                    this.checkStream();
                }, newInterval);
                
                // Reset state for new prime time session
                if (isPrime) {
                    this.checkedToday = false;
                    this.todayDate = new Date().toDateString();
                }
            }
        }, 5000); // Check every 5 seconds

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

        // Skip checks if in sleep mode (outside prime time)
        const isPrime = this.isInPrimeTime();
        if (!isPrime) {
            // Only log occasionally so logs don't get spammy
            if (this.totalChecks % 20 === 0) {
                logger.info(`💤 Sleep mode - Waiting for 8pm... (${new Date().toLocaleTimeString()})`);
            }
            this.totalChecks++;
            return;
        }

        this.totalChecks++;
        this.primeChecks++;
        this.lastCheckTime = new Date().toISOString();
        const timestamp = new Date().toLocaleTimeString();

        try {
            // Log every check during prime time (every 10 seconds)
            logger.info(`🔍 [${timestamp}] Prime check #${this.primeChecks} (every 10s)`);

            const streamData = await this.youtubeService.checkLiveStatus();

            if (streamData) {
                // NEW LIVESTREAM DETECTED! Send notification immediately
                logger.info(`🔴🔴🔴 LIVESTREAM DETECTED! 🔴🔴🔴`);
                logger.info(`📺 Title: ${streamData.title}`);
                logger.info(`🔗 URL: ${streamData.url}`);
                logger.info(`⏰ Detected at: ${timestamp}`);
                logger.info(`⚡ Detected in ${this.primeChecks} checks (${(this.primeChecks * 10)} seconds into prime time)`);

                // Check if polls feature is enabled
                const pollsEnabled = featureManager.isEnabled('polls');
                logger.info(`📊 Polls feature: ${pollsEnabled ? 'ENABLED' : 'DISABLED'}`);

                // Send notification INSTANTLY
                const result = await this.notificationService.sendLivestreamNotification(
                    streamData,
                    this.config.youtube.notificationChannelId,
                    true // @everyone
                );

                if (result.success) {
                    this.notificationsSent++;
                    this.lastLiveStreamId = streamData.videoId;
                    this.checkedToday = true;
                    this.todayDate = new Date().toDateString();
                    logger.info(`✅✅✅ NOTIFICATION SENT INSTANTLY! ✅✅✅`);
                    logger.info(`📢 Detection time: ${(this.primeChecks * 10)} seconds after 8pm`);
                } else {
                    logger.error(`❌ Failed to send notification: ${result.error}`);
                }
            } else {
                // No stream detected yet, continue checking
                if (this.primeChecks % 6 === 0) { // Log every minute (6 checks at 10s each)
                    logger.info(`⏳ No stream yet... (${this.primeChecks} checks, ${(this.primeChecks * 10)}s into prime time)`);
                }
            }

        } catch (error) {
            logger.error(`❌ Error during stream check: ${error.message}`);
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
     */
    getStats() {
        const isPrime = this.isInPrimeTime();
        return {
            isRunning: this.isRunning,
            isPrimeTime: isPrime,
            mode: isPrime ? '🔴 INSTANT DETECTION (10s)' : '💤 SLEEP MODE',
            checkInterval: isPrime ? 
                `${this.config.youtube.primeInterval / 1000} seconds` : 
                'No checks (sleeping until 8pm)',
            totalChecks: this.totalChecks,
            primeChecks: this.primeChecks,
            notificationsSent: this.notificationsSent,
            lastCheckTime: this.lastCheckTime,
            lastLiveStreamId: this.lastLiveStreamId,
            currentStatus: this.youtubeService.getStatus(),
            hasActivePoll: this.client.activePolls ? 
                Object.keys(this.client.activePolls).length > 0 : false,
            pollsEnabled: featureManager.isEnabled('polls'),
            nextPrimeTime: this.getNextPrimeTime()
        };
    }

    /**
     * Get time until next prime time starts
     */
    getNextPrimeTime() {
        const now = new Date();
        const primeStart = this.config.youtube.primeStart || 20;
        let next = new Date(now);
        next.setHours(primeStart, 0, 0, 0);
        
        if (now.getHours() >= primeStart) {
            next.setDate(next.getDate() + 1);
        }
        
        const diff = next - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diff > 0) {
            return `${hours}h ${minutes}m`;
        }
        return 'Now!';
    }

    /**
     * Reset the state
     */
    resetState() {
        this.youtubeService.resetState();
        this.lastLiveStreamId = null;
        this.checkedToday = false;
        this.todayDate = null;
        this.primeChecks = 0;
        if (this.client.activePolls) {
            this.client.activePolls = {};
        }
        logger.info('🔄 Livestream manager state reset');
    }
}

module.exports = LivestreamManager;