const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_done_.+$/,
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_done_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.editReply({
                content: '❌ Match not found.'
            });
        }
        
        // Stop the collector if still active
        if (interaction.client.tempMatches && interaction.client.tempMatches[matchId]) {
            const temp = interaction.client.tempMatches[matchId];
            if (temp.collector) {
                temp.collector.stop();
            }
            delete interaction.client.tempMatches[matchId];
        }
        
        // Get final screenshots
        const screenshots = match.screenshots || [];
        const screenshotCount = screenshots.length;
        
        // Create professional embed for submission channel
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Match Result Submission')
            .setDescription(`Match ID: **${matchId}**`)
            .addFields(
                { name: 'Tournament', value: match.tournament, inline: true },
                { name: 'Submitted By', value: interaction.user.tag, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Squad 1', value: `**${match.squad1.name}**\nScore: ${match.squad1.score}`, inline: true },
                { name: 'Squad 2', value: `**${match.squad2.name}**\nScore: ${match.squad2.score}`, inline: true },
                { name: 'Winner', value: match.winner, inline: true },
                { name: '📸 Screenshots', value: screenshotCount > 0 ? `${screenshotCount} screenshot(s) attached` : 'No screenshots', inline: true }
            )
            .setTimestamp();
        
        // Add screenshot links if any
        if (screenshotCount > 0) {
            const screenshotLinks = screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
            embed.addFields({ name: 'Screenshots', value: screenshotLinks, inline: false });
            embed.setImage(screenshots[0]); // Show first screenshot as preview
        }
        
        // Send to match submission channel
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (!submissionChannel) {
            return interaction.editReply({
                content: '❌ Match submission channel not configured.'
            });
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_verify_${matchId}`)
                    .setLabel('✅ Verify')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`match_reject_${matchId}`)
                    .setLabel('❌ Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
        
        const message = await submissionChannel.send({
            content: `<@&${config.tournamentManagerRoleId}> <@&${config.adminRoleId}>`,
            embeds: [embed],
            components: [row]
        });
        
        // Store message ID for updates
        await database.updateMatch(matchId, { messageId: message.id });
        
        // Reply to user
        await interaction.editReply({
            content: `✅ Match result submitted successfully!\n**Match ID:** \`${matchId}\`\n**Match:** ${match.squad1.name} vs ${match.squad2.name}\n**Score:** ${match.squad1.score} - ${match.squad2.score}\n**Screenshots:** ${screenshotCount} uploaded`
        });
        
        logger.info(`Match submitted: ${matchId} by ${interaction.user.tag} with ${screenshotCount} screenshots`);
    }
};