/**
 * YouTube Livestream Monitoring Service
 * Handles all YouTube Data API v3 interactions
 */
const axios = require('axios');
const logger = require('../utils/logger');

class YouTubeService {
    constructor(apiKey, channelId) {
        this.apiKey = apiKey;
        this.channelId = channelId;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.lastLiveStreamId = null;
        this.isLive = false;
        this.currentStreamData = null;
    }

    /**
     * Check if the channel is currently live
     * @returns {Promise<Object>} - Live stream data or null if not live
     */
    async checkLiveStatus() {
        try {
            // Validate API key before making request
            if (!this.apiKey) {
                throw new Error('YouTube API key is not configured. Please set YOUTUBE_API_KEY in .env');
            }

            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    part: 'snippet',
                    channelId: this.channelId,
                    eventType: 'live',
                    type: 'video',
                    key: this.apiKey
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.status !== 200) {
                throw new Error(`YouTube API returned status ${response.status}`);
            }

            const items = response.data.items || [];

            if (items.length === 0) {
                // Channel is not live
                if (this.isLive) {
                    logger.info(`📴 Channel is no longer live (was live with stream: ${this.lastLiveStreamId})`);
                    this.isLive = false;
                    this.currentStreamData = null;
                }
                return null;
            }

            // Channel is live
            const liveVideo = items[0];
            const videoId = liveVideo.id.videoId;
            const streamData = {
                videoId: videoId,
                title: liveVideo.snippet.title,
                description: liveVideo.snippet.description,
                thumbnail: liveVideo.snippet.thumbnails.high?.url || 
                           liveVideo.snippet.thumbnails.medium?.url || 
                           liveVideo.snippet.thumbnails.default?.url,
                channelTitle: liveVideo.snippet.channelTitle,
                publishedAt: liveVideo.snippet.publishedAt,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };

            // Check if this is a new livestream (different from last announced)
            if (this.lastLiveStreamId !== videoId) {
                // This is a new livestream
                this.isLive = true;
                this.lastLiveStreamId = videoId;
                this.currentStreamData = streamData;
                logger.info(`🔴 New livestream detected: "${streamData.title}" (${videoId})`);
                return streamData;
            }

            // Same livestream as before - return current data but mark as duplicate
            this.isLive = true;
            this.currentStreamData = streamData;
            logger.info(`🔄 Checked: Same livestream still active - "${streamData.title}"`);
            return null; // Return null to indicate no new notification needed

        } catch (error) {
            // Handle specific error types
            if (error.code === 'ECONNABORTED') {
                logger.error(`❌ YouTube API request timeout: ${error.message}`);
            } else if (error.response) {
                // YouTube API returned an error response
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 403) {
                    if (data.error?.errors?.[0]?.reason === 'quotaExceeded') {
                        logger.error('❌ YouTube API quota exceeded. Resetting at midnight PT.');
                    } else {
                        logger.error(`❌ YouTube API permission denied: ${JSON.stringify(data.error)}`);
                    }
                } else if (status === 400) {
                    logger.error(`❌ YouTube API bad request: ${JSON.stringify(data.error)}`);
                } else if (status === 404) {
                    logger.error('❌ YouTube channel not found. Check CHANNEL_ID in .env');
                } else {
                    logger.error(`❌ YouTube API error (${status}): ${JSON.stringify(data.error)}`);
                }
            } else if (error.message.includes('API key')) {
                logger.error('❌ Invalid YouTube API key. Please check YOUTUBE_API_KEY in .env');
            } else {
                logger.error(`❌ YouTube API error: ${error.message}`);
            }
            
            return null;
        }
    }

    /**
     * Get detailed stream information (for additional details if needed)
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Object>} - Detailed stream data
     */
    async getStreamDetails(videoId) {
        try {
            const response = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,liveStreamingDetails,statistics',
                    id: videoId,
                    key: this.apiKey
                },
                timeout: 10000
            });

            if (response.status !== 200 || !response.data.items || response.data.items.length === 0) {
                return null;
            }

            const video = response.data.items[0];
            return {
                viewCount: video.statistics?.viewCount || '0',
                likeCount: video.statistics?.likeCount || '0',
                concurrentViewers: video.liveStreamingDetails?.concurrentViewers || '0',
                actualStartTime: video.liveStreamingDetails?.actualStartTime,
                scheduledStartTime: video.liveStreamingDetails?.scheduledStartTime
            };
        } catch (error) {
            logger.error(`❌ Failed to get stream details: ${error.message}`);
            return null;
        }
    }

    /**
     * Reset the live state (useful for testing or manual reset)
     */
    resetState() {
        this.lastLiveStreamId = null;
        this.isLive = false;
        this.currentStreamData = null;
        logger.info('🔄 YouTube service state reset');
    }

    /**
     * Get current live status without triggering notifications
     * @returns {Object} - Current status
     */
    getStatus() {
        return {
            isLive: this.isLive,
            lastLiveStreamId: this.lastLiveStreamId,
            currentStreamData: this.currentStreamData
        };
    }
}

module.exports = YouTubeService;