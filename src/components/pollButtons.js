/**
 * Poll Button Handlers
 * Handles vote buttons for livestream polls
 */
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = [
    {
        type: 'button',
        customId: /^poll_squad1_.+$/,
        async execute(interaction) {
            const videoId = interaction.customId.replace('poll_squad1_', '');
            const notificationService = interaction.client.notificationService;
            
            if (!notificationService) {
                return interaction.reply({
                    content: '❌ Poll system is not available.',
                    flags: 64
                });
            }

            // Check if poll exists
            const poll = notificationService.client.activePolls?.[videoId];
            if (!poll) {
                return interaction.reply({
                    content: '❌ This poll has expired or no longer exists. A new livestream will create a new poll.',
                    flags: 64
                });
            }

            await notificationService.handlePollVote(interaction, videoId, 'squad1');
        }
    },
    {
        type: 'button',
        customId: /^poll_squad2_.+$/,
        async execute(interaction) {
            const videoId = interaction.customId.replace('poll_squad2_', '');
            const notificationService = interaction.client.notificationService;
            
            if (!notificationService) {
                return interaction.reply({
                    content: '❌ Poll system is not available.',
                    flags: 64
                });
            }

            const poll = notificationService.client.activePolls?.[videoId];
            if (!poll) {
                return interaction.reply({
                    content: '❌ This poll has expired or no longer exists. A new livestream will create a new poll.',
                    flags: 64
                });
            }

            await notificationService.handlePollVote(interaction, videoId, 'squad2');
        }
    },
    {
        type: 'button',
        customId: /^poll_tie_.+$/,
        async execute(interaction) {
            const videoId = interaction.customId.replace('poll_tie_', '');
            const notificationService = interaction.client.notificationService;
            
            if (!notificationService) {
                return interaction.reply({
                    content: '❌ Poll system is not available.',
                    flags: 64
                });
            }

            const poll = notificationService.client.activePolls?.[videoId];
            if (!poll) {
                return interaction.reply({
                    content: '❌ This poll has expired or no longer exists. A new livestream will create a new poll.',
                    flags: 64
                });
            }

            await notificationService.handlePollVote(interaction, videoId, 'tie');
        }
    },
    {
        type: 'button',
        customId: /^poll_view_.+$/,
        async execute(interaction) {
            const videoId = interaction.customId.replace('poll_view_', '');
            const notificationService = interaction.client.notificationService;
            
            if (!notificationService) {
                return interaction.reply({
                    content: '❌ Poll system is not available.',
                    flags: 64
                });
            }

            const poll = notificationService.client.activePolls?.[videoId];
            if (!poll) {
                return interaction.reply({
                    content: '❌ No active poll found for this livestream.',
                    flags: 64
                });
            }

            const results = notificationService.getPollResults(videoId);
            
            if (!results) {
                return interaction.reply({
                    content: '❌ No poll found for this livestream.',
                    flags: 64
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📊 Poll Results')
                .setDescription(results.formatted)
                .addFields(
                    { name: 'Total Votes', value: results.totalVotes.toString(), inline: true },
                    { name: 'Leading', value: results.totalVotes > 0 ? getLeading(results) : 'No votes yet', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Poll for: ${poll.streamTitle || 'Livestream'}` });

            await interaction.reply({
                embeds: [embed],
                flags: 64
            });
        }
    }
];

// Helper function to determine leading option
function getLeading(results) {
    const maxVotes = Math.max(results.squad1Votes, results.squad2Votes, results.tieVotes);
    if (maxVotes === 0) return 'No votes yet';
    if (results.squad1Votes === maxVotes) return '🏆 Squad 1';
    if (results.squad2Votes === maxVotes) return '🏆 Squad 2';
    return '🤝 Tie';
}