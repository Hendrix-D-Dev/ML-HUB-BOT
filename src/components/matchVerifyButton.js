const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_verify_.+$/,
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_verify_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.editReply({
                content: '❌ Match not found.'
            });
        }
        
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isTournamentManager = interaction.member.roles.cache.has(config.tournamentManagerRoleId);
        
        if (!isAdmin && !isMod && !isTournamentManager) {
            return interaction.editReply({
                content: '❌ You don\'t have permission to verify matches.'
            });
        }
        
        if (match.status === 'verified') {
            return interaction.editReply({
                content: '❌ This match is already verified.'
            });
        }
        
        if (match.status === 'rejected') {
            return interaction.editReply({
                content: '❌ This match has already been rejected.'
            });
        }
        
        await database.updateMatch(matchId, {
            status: 'verified',
            verifiedBy: {
                userId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date().toISOString()
            }
        });
        
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                
                originalEmbed.setColor(0x00FF00);
                originalEmbed.addFields({ 
                    name: 'Verified By', 
                    value: interaction.user.tag, 
                    inline: true 
                });
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_verify_${matchId}`)
                            .setLabel('Verified')
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
        
        if (match.threadId) {
            try {
                const thread = await interaction.guild.channels.fetch(match.threadId);
                if (thread && thread.isThread()) {
                    await thread.setLocked(true);
                    await thread.setArchived(true);
                    await thread.send({ 
                        content: `🔒 This thread has been archived.`
                    });
                }
            } catch (error) {
                logger.error(`Error archiving thread: ${error.message}`);
            }
        }
        
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Match Verified')
            .setDescription(`Match **${matchId}** has been verified`)
            .addFields(
                { name: 'Winner', value: match.winner, inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [confirmEmbed] });
        
        logger.info(`Match verified: ${matchId} by ${interaction.user.tag}`);
    }
};