/**
 * Notification Service for Discord
 * Handles formatting and sending notifications with polls
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

class NotificationService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Send a livestream notification to a Discord channel with a poll
     * @param {Object} streamData - Stream data from YouTube API
     * @param {string} channelId - Discord channel ID to send to
     * @param {boolean} mentionEveryone - Whether to @everyone
     * @returns {Promise<Object>} - Success status and message info
     */
    async sendLivestreamNotification(streamData, channelId, mentionEveryone = true) {
        try {
            if (!channelId) {
                logger.error('❌ Notification channel ID not configured');
                return { success: false, error: 'Channel ID not configured' };
            }

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                logger.error(`❌ Channel ${channelId} not found`);
                return { success: false, error: 'Channel not found' };
            }

            // Build the notification embed
            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // Red color for live
                .setTitle('🔴 WE ARE LIVE!')
                .setDescription(`**${streamData.title}**`)
                .addFields(
                    { name: '📺 Watch Live', value: `${streamData.url}`, inline: false },
                    { name: '👥 Vote Below', value: 'Click a button to predict the winner of this match!', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'ML HUB BOT • YouTube Live' });

            // Add thumbnail if available
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            }

            // Create poll buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_squad1_${streamData.videoId}`)
                        .setLabel('🏆 Squad 1')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚔️'),
                    new ButtonBuilder()
                        .setCustomId(`poll_squad2_${streamData.videoId}`)
                        .setLabel('🏆 Squad 2')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚔️'),
                    new ButtonBuilder()
                        .setCustomId(`poll_tie_${streamData.videoId}`)
                        .setLabel('🤝 Tie')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🤝'),
                    new ButtonBuilder()
                        .setCustomId(`poll_view_${streamData.videoId}`)
                        .setLabel('📊 View Results')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📊')
                );

            // Build the message content
            let content = '';
            if (mentionEveryone) {
                content = '@everyone 🔴 We\'re live on YouTube!';
            }

            // Send the notification with poll
            const message = await channel.send({
                content: content,
                embeds: [embed],
                components: [row]
            });

            // Store poll data for this stream
            this.client.activePolls = this.client.activePolls || {};
            this.client.activePolls[streamData.videoId] = {
                messageId: message.id,
                channelId: channelId,
                streamTitle: streamData.title,
                streamUrl: streamData.url,
                squad1Votes: 0,
                squad2Votes: 0,
                tieVotes: 0,
                voters: new Set(),
                startedAt: Date.now()
            };

            logger.info(`📢 Livestream notification with poll sent: "${streamData.title}"`);
            return { success: true, messageId: message.id };

        } catch (error) {
            logger.error(`❌ Failed to send notification: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle poll vote button click
     * @param {Object} interaction - Discord interaction
     * @param {string} videoId - YouTube video ID
     * @param {string} voteType - 'squad1', 'squad2', or 'tie'
     */
    async handlePollVote(interaction, videoId, voteType) {
        try {
            const poll = this.client.activePolls?.[videoId];
            if (!poll) {
                return interaction.reply({
                    content: '❌ This poll has expired or no longer exists.',
                    flags: 64
                });
            }

            const userId = interaction.user.id;

            // Check if user already voted
            if (poll.voters.has(userId)) {
                return interaction.reply({
                    content: '❌ You have already voted on this match!',
                    flags: 64
                });
            }

            // Record the vote
            poll.voters.add(userId);
            
            let voteLabel = '';
            if (voteType === 'squad1') {
                poll.squad1Votes++;
                voteLabel = 'Squad 1';
            } else if (voteType === 'squad2') {
                poll.squad2Votes++;
                voteLabel = 'Squad 2';
            } else if (voteType === 'tie') {
                poll.tieVotes++;
                voteLabel = 'Tie';
            }

            logger.info(`🗳️ Vote recorded: ${interaction.user.tag} voted for ${voteLabel} on ${videoId}`);

            // Update the poll message with new vote counts
            await this.updatePollMessage(videoId);

            return interaction.reply({
                content: `✅ You voted for **${voteLabel}**!`,
                flags: 64
            });

        } catch (error) {
            logger.error(`❌ Error handling poll vote: ${error.message}`);
            return interaction.reply({
                content: '❌ An error occurred while processing your vote.',
                flags: 64
            });
        }
    }

    /**
     * Update the poll message with current vote counts
     * @param {string} videoId - YouTube video ID
     */
    async updatePollMessage(videoId) {
        try {
            const poll = this.client.activePolls?.[videoId];
            if (!poll) return;

            const channel = await this.client.channels.fetch(poll.channelId);
            if (!channel) return;

            const message = await channel.messages.fetch(poll.messageId);
            if (!message) return;

            const totalVotes = poll.squad1Votes + poll.squad2Votes + poll.tieVotes;

            // Create updated embed with vote counts
            const embed = EmbedBuilder.from(message.embeds[0]);
            
            // Update or add vote fields
            const voteField = embed.data.fields?.find(f => f.name === '📊 Current Votes');
            if (voteField) {
                voteField.value = this.formatVoteResults(poll);
            } else {
                embed.addFields({ 
                    name: '📊 Current Votes', 
                    value: this.formatVoteResults(poll),
                    inline: false 
                });
            }

            // Add total votes field
            const totalField = embed.data.fields?.find(f => f.name === '👥 Total Votes');
            if (totalField) {
                totalField.value = totalVotes.toString();
            } else {
                embed.addFields({ 
                    name: '👥 Total Votes', 
                    value: totalVotes.toString(),
                    inline: true 
                });
            }

            // Update the message
            await message.edit({ embeds: [embed] });

        } catch (error) {
            logger.error(`❌ Error updating poll message: ${error.message}`);
        }
    }

    /**
     * Format vote results for display
     * @param {Object} poll - Poll data
     * @returns {string} - Formatted vote results
     */
    formatVoteResults(poll) {
        const totalVotes = poll.squad1Votes + poll.squad2Votes + poll.tieVotes;
        if (totalVotes === 0) {
            return 'No votes yet. Be the first to vote!';
        }

        const squad1Pct = ((poll.squad1Votes / totalVotes) * 100).toFixed(1);
        const squad2Pct = ((poll.squad2Votes / totalVotes) * 100).toFixed(1);
        const tiePct = ((poll.tieVotes / totalVotes) * 100).toFixed(1);

        // Create visual progress bars
        const barLength = 10;
        const squad1Bars = Math.round((poll.squad1Votes / totalVotes) * barLength);
        const squad2Bars = Math.round((poll.squad2Votes / totalVotes) * barLength);
        const tieBars = Math.round((poll.tieVotes / totalVotes) * barLength);

        return `🏆 **Squad 1:** ${'🟦'.repeat(squad1Bars)}${'⬜'.repeat(barLength - squad1Bars)} ${poll.squad1Votes} votes (${squad1Pct}%)\n` +
               `🏆 **Squad 2:** ${'🟥'.repeat(squad2Bars)}${'⬜'.repeat(barLength - squad2Bars)} ${poll.squad2Votes} votes (${squad2Pct}%)\n` +
               `🤝 **Tie:**      ${'🟨'.repeat(tieBars)}${'⬜'.repeat(barLength - tieBars)} ${poll.tieVotes} votes (${tiePct}%)`;
    }

    /**
     * Get poll results
     * @param {string} videoId - YouTube video ID
     * @returns {Object|null} - Poll results or null
     */
    getPollResults(videoId) {
        const poll = this.client.activePolls?.[videoId];
        if (!poll) return null;

        const totalVotes = poll.squad1Votes + poll.squad2Votes + poll.tieVotes;
        
        return {
            totalVotes,
            squad1Votes: poll.squad1Votes,
            squad2Votes: poll.squad2Votes,
            tieVotes: poll.tieVotes,
            squad1Percent: totalVotes > 0 ? ((poll.squad1Votes / totalVotes) * 100).toFixed(1) : 0,
            squad2Percent: totalVotes > 0 ? ((poll.squad2Votes / totalVotes) * 100).toFixed(1) : 0,
            tiePercent: totalVotes > 0 ? ((poll.tieVotes / totalVotes) * 100).toFixed(1) : 0,
            formatted: this.formatVoteResults(poll)
        };
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
                thumbnail: null,
                videoId: 'test_123'
            };

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🧪 TEST NOTIFICATION')
                .setDescription('This is a test notification for the YouTube livestream system.\n\nIf you see this, the notification system is working!')
                .addFields(
                    { name: 'Status', value: '✅ Notification system operational', inline: true },
                    { name: 'Poll System', value: '✅ Poll system active', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'ML HUB BOT • Test Mode' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('poll_test_squad1')
                        .setLabel('🏆 Squad 1')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚔️')
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('poll_test_squad2')
                        .setLabel('🏆 Squad 2')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚔️')
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('poll_test_tie')
                        .setLabel('🤝 Tie')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🤝')
                        .setDisabled(true)
                );

            const channel = await this.client.channels.fetch(channelId);
            await channel.send({ embeds: [embed], components: [row] });

            logger.info('📢 Test notification sent successfully');
            return true;

        } catch (error) {
            logger.error(`❌ Failed to send test notification: ${error.message}`);
            return false;
        }
    }
}

module.exports = NotificationService;