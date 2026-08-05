/**
 * Notification Service for Discord
 * Handles formatting and sending notifications
 */
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

class NotificationService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Send a livestream notification to a Discord channel
     * @param {Object} streamData - Stream data from YouTube API
     * @param {string} channelId - Discord channel ID to send to
     * @param {boolean} mentionEveryone - Whether to @everyone
     * @returns {Promise<boolean>} - Success status
     */
    async sendLivestreamNotification(streamData, channelId, mentionEveryone = true) {
        try {
            if (!channelId) {
                logger.error('❌ Notification channel ID not configured');
                return false;
            }

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                logger.error(`❌ Channel ${channelId} not found`);
                return false;
            }

            // Build the notification embed
            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // Red color for live
                .setTitle('🔴 WE ARE LIVE!')
                .setDescription(`We're now live on YouTube!\n\n**${streamData.title}**`)
                .addFields(
                    { name: 'Watch here:', value: streamData.url, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'ML HUB BOT • YouTube Live Notifications' });

            // Add thumbnail if available
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            }

            // Build the message content
            let content = '';
            if (mentionEveryone) {
                content = '@everyone';
            }

            // Send the notification
            await channel.send({
                content: content,
                embeds: [embed]
            });

            logger.info(`📢 Livestream notification sent for: "${streamData.title}"`);
            return true;

        } catch (error) {
            logger.error(`❌ Failed to send notification: ${error.message}`);
            return false;
        }
    }

    /**
     * Send a test notification (for testing purposes)
     * @param {string} channelId - Discord channel ID
     * @returns {Promise<boolean>} - Success status
     */
    async sendTestNotification(channelId) {
        try {
            const testData = {
                title: 'TEST LIVESTREAM - This is a test notification',
                url: 'https://www.youtube.com/watch?v=test',
                thumbnail: null
            };

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🧪 TEST NOTIFICATION')
                .setDescription('This is a test notification for the YouTube livestream system.\n\nIf you see this, the notification system is working!')
                .addFields(
                    { name: 'Status', value: '✅ Notification system operational', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'ML HUB BOT • Test Mode' });

            const channel = await this.client.channels.fetch(channelId);
            await channel.send({ embeds: [embed] });

            logger.info('📢 Test notification sent successfully');
            return true;

        } catch (error) {
            logger.error(`❌ Failed to send test notification: ${error.message}`);
            return false;
        }
    }
}

module.exports = NotificationService;