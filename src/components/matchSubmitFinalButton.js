const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_submit_final_.+$/,
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_submit_final_', '');
        
        const pendingMatch = interaction.client.pendingMatches?.[matchId];
        if (!pendingMatch) {
            return interaction.editReply({
                content: '❌ Match session expired. Please start over.'
            });
        }
        
        // Stop the collector
        if (pendingMatch.collector) {
            pendingMatch.collector.stop();
        }
        
        const {
            squad1Name, squad2Name, squad1Score, squad2Score,
            tournament, winner, userId, userTag, screenshots
        } = pendingMatch;
        
        // Create match in database
        const matchData = {
            matchId,
            squad1: { name: squad1Name, score: squad1Score },
            squad2: { name: squad2Name, score: squad2Score },
            winner,
            screenshots,
            submittedBy: { userId, username: userTag },
            tournament,
            status: 'pending',
            matchDate: new Date().toISOString()
        };
        
        await database.createMatch(matchData);
        
        // Create professional embed for submission channel
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Match Result Submission')
            .setDescription(`Match ID: **${matchId}**`)
            .addFields(
                { name: 'Tournament', value: tournament, inline: true },
                { name: 'Submitted By', value: userTag, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Squad 1', value: `**${squad1Name}**\nScore: ${squad1Score}`, inline: true },
                { name: 'Squad 2', value: `**${squad2Name}**\nScore: ${squad2Score}`, inline: true },
                { name: 'Winner', value: winner, inline: true },
                { name: '📸 Screenshots', value: `${screenshots.length} screenshot(s) attached`, inline: true }
            )
            .setTimestamp();
        
        // Add screenshot links if any
        if (screenshots.length > 0) {
            const screenshotLinks = screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
            embed.addFields({ name: 'Screenshots', value: screenshotLinks, inline: false });
            embed.setImage(screenshots[0]);
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
        
        // Clean up temporary data
        delete interaction.client.pendingMatches[matchId];
        
        // Reply to user
        await interaction.editReply({
            content: `✅ Match submitted successfully!\n**Match ID:** \`${matchId}\`\n**Match:** ${squad1Name} vs ${squad2Name}\n**Score:** ${squad1Score} - ${squad2Score}\n**Screenshots:** ${screenshots.length} uploaded`
        });
        
        logger.info(`Match submitted: ${matchId} by ${userTag} with ${screenshots.length} screenshots`);
    }
};