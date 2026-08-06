/**
 * YouTube Livestream Monitoring Service
 * Handles all YouTube Data API v3 interactions - OPTIMIZED for quota
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
        this.quotaUsed = 0;
        this.quotaResetTime = null;
    }

    /**
     * Check if the channel is currently live - OPTIMIZED version
     * Uses the videos endpoint (1 unit) instead of search (100 units)
     */
    async checkLiveStatus() {
        try {
            if (!this.apiKey) {
                throw new Error('YouTube API key not configured');
            }

            // Step 1: Get the channel's uploads playlist ID (1 unit - free)
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'contentDetails',
                    id: this.channelId,
                    key: this.apiKey
                },
                timeout: 10000
            });

            if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
                logger.error('❌ Channel not found');
                return null;
            }

            const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

            // Step 2: Get the latest video from the channel (1 unit)
            const videosResponse = await axios.get(`${this.baseUrl}/playlistItems`, {
                params: {
                    part: 'snippet',
                    playlistId: uploadsPlaylistId,
                    maxResults: 5,
                    key: this.apiKey
                },
                timeout: 10000
            });

            if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
                return null;
            }

            // Step 3: Check each recent video for livestream status
            const videoIds = videosResponse.data.items.map(item => item.snippet.resourceId.videoId).join(',');

            const videoResponse = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,liveStreamingDetails',
                    id: videoIds,
                    key: this.apiKey
                },
                timeout: 10000
            });

            // Track quota usage (approximately)
            this.quotaUsed += 3; // Channel + Playlist + Videos calls

            if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
                return null;
            }

            // Find the first video that is currently live
            for (const video of videoResponse.data.items) {
                if (video.liveStreamingDetails && video.liveStreamingDetails.actualStartTime) {
                    const videoId = video.id;
                    const streamData = {
                        videoId: videoId,
                        title: video.snippet.title,
                        description: video.snippet.description,
                        thumbnail: video.snippet.thumbnails.high?.url || 
                                   video.snippet.thumbnails.medium?.url || 
                                   video.snippet.thumbnails.default?.url,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        concurrentViewers: video.liveStreamingDetails?.concurrentViewers || '0'
                    };

                    // Check if this is a new livestream
                    if (this.lastLiveStreamId !== videoId) {
                        this.isLive = true;
                        this.lastLiveStreamId = videoId;
                        this.currentStreamData = streamData;
                        logger.info(`🔴 New livestream detected: "${streamData.title}" (${videoId})`);
                        return streamData;
                    }

                    // Same livestream - no notification needed
                    this.isLive = true;
                    this.currentStreamData = streamData;
                    logger.info(`🔄 Checked: Same livestream still active - "${streamData.title}"`);
                    return null;
                }
            }

            // No live videos found
            if (this.isLive) {
                logger.info(`📴 Channel is no longer live (was: ${this.lastLiveStreamId})`);
                this.isLive = false;
                this.currentStreamData = null;
            }
            return null;

        } catch (error) {
            // Handle specific error types
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 429) {
                    logger.error(`❌ YouTube API quota exceeded. The bot will try again later.`);
                    logger.warn(`⚠️ Please reduce check frequency or request higher quota.`);
                    logger.info(`ℹ️ Next check will happen in ${this.getTimeUntilReset() || 'unknown time'}`);
                } else if (status === 403) {
                    logger.error(`❌ YouTube API permission denied: ${JSON.stringify(data.error)}`);
                } else if (status === 400) {
                    logger.error(`❌ YouTube API bad request: ${JSON.stringify(data.error)}`);
                } else if (status === 404) {
                    logger.error('❌ YouTube channel not found. Check CHANNEL_ID in .env');
                } else {
                    logger.error(`❌ YouTube API error (${status}): ${JSON.stringify(data.error)}`);
                }
            } else if (error.code === 'ECONNABORTED') {
                logger.error(`❌ YouTube API request timeout: ${error.message}`);
            } else {
                logger.error(`❌ YouTube API error: ${error.message}`);
            }
            
            return null;
        }
    }

    /**
     * Get time until quota reset (approximate)
     */
    getTimeUntilReset() {
        const now = new Date();
        const resetTime = new Date();
        resetTime.setHours(24, 0, 0, 0); // Midnight PT
        const diff = resetTime - now;
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        }
        return null;
    }

    /**
     * Get quota usage stats
     */
    getQuotaStats() {
        return {
            quotaUsed: this.quotaUsed,
            quotaResetTime: this.quotaResetTime
        };
    }

    /**
     * Reset the state
     */
    resetState() {
        this.lastLiveStreamId = null;
        this.isLive = false;
        this.currentStreamData = null;
        logger.info('🔄 YouTube service state reset');
    }

    /**
     * Get current status
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