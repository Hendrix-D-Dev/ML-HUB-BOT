const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: /^match_reject_modal_.+$/,
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_reject_modal_', '');
        const reason = interaction.fields.getTextInputValue('reason');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.editReply({
                content: '❌ Match not found.'
            });
        }
        
        await database.updateMatch(matchId, {
            status: 'rejected',
            rejectedBy: {
                userId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date().toISOString()
            },
            rejectionReason: reason
        });
        
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                
                originalEmbed.setColor(0xFF0000);
                originalEmbed.addFields(
                    { name: 'Rejected By', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                );
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_verify_${matchId}`)
                            .setLabel('Verify')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`match_reject_${matchId}`)
                            .setLabel('Rejected')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                            .setDisabled(true)
                    );
                
                await originalMessage.edit({ embeds: [originalEmbed], components: [row] });
                
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
            }
        }
        
        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Match Rejected')
            .setDescription(`Match **${matchId}** has been rejected`)
            .addFields(
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [confirmEmbed] });
        
        logger.info(`Match rejected: ${matchId} by ${interaction.user.tag}`);
    }
};