const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: /^match_reject_modal_.+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace('match_reject_modal_', '');
        const reason = interaction.fields.getTextInputValue('reason');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Update match status
        await database.updateMatch(matchId, {
            status: 'rejected',
            rejectedBy: {
                userId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date().toISOString()
            },
            rejectionReason: reason
        });
        
        // Update the original message
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                
                // Update embed color and add rejection info
                originalEmbed.setColor(0xFF0000);
                originalEmbed.addFields(
                    { name: '❌ Rejected By', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                );
                
                // Disable buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_screenshot_${matchId}`)
                            .setLabel('📸 Add Screenshot')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📸')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`match_verify_${matchId}`)
                            .setLabel('✅ Verify')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`match_reject_${matchId}`)
                            .setLabel('❌ Rejected')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                            .setDisabled(true)
                    );
                
                await originalMessage.edit({ embeds: [originalEmbed], components: [row] });
                
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
            }
        }
        
        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Match Rejected')
            .setDescription(`Match **${matchId}** has been rejected by ${interaction.user.tag}`)
            .addFields(
                { name: 'Reason', value: reason, inline: false },
                { name: 'Squad 1', value: `${match.squad1.name} (${match.squad1.score})`, inline: true },
                { name: 'Squad 2', value: `${match.squad2.name} (${match.squad2.score})`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [confirmEmbed], flags: 64 });
        
        // Also notify in the match submission channel
        if (submissionChannel) {
            const notificationEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Match Rejected')
                .setDescription(`Match **${matchId}** has been rejected by ${interaction.user.tag}`)
                .addFields({ name: 'Reason', value: reason, inline: false })
                .setTimestamp();
            
            await submissionChannel.send({ embeds: [notificationEmbed] });
        }
        
        logger.info(`Match rejected: ${matchId} by ${interaction.user.tag}`);
    }
};