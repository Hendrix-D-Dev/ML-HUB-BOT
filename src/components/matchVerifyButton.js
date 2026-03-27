const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_verify_.+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace('match_verify_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Check if user has admin or mod permissions
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isTournamentManager = interaction.member.roles.cache.has(config.tournamentManagerRoleId);
        
        if (!isAdmin && !isMod && !isTournamentManager) {
            return interaction.reply({
                content: '❌ You don\'t have permission to verify matches!',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified!',
                flags: 64
            });
        }
        
        // Update match status
        await database.updateMatch(matchId, {
            status: 'verified',
            verifiedBy: {
                userId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date().toISOString()
            }
        });
        
        // Update the original message
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                
                // Update embed color and add verification info
                originalEmbed.setColor(0x00FF00);
                originalEmbed.addFields({ 
                    name: '✅ Verified By', 
                    value: interaction.user.tag, 
                    inline: true 
                });
                
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
                            .setLabel('✅ Verified')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`match_reject_${matchId}`)
                            .setLabel('❌ Reject')
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
            .setColor(0x00FF00)
            .setTitle('✅ Match Verified')
            .setDescription(`Match **${matchId}** has been verified by ${interaction.user.tag}`)
            .addFields(
                { name: 'Squad 1', value: `${match.squad1.name} (${match.squad1.score})`, inline: true },
                { name: 'Squad 2', value: `${match.squad2.name} (${match.squad2.score})`, inline: true },
                { name: 'Winner', value: match.winner, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [confirmEmbed], flags: 64 });
        
        // Also notify in the match submission channel
        if (submissionChannel) {
            const notificationEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Match Verified')
                .setDescription(`Match **${matchId}** has been verified by ${interaction.user.tag}`)
                .setTimestamp();
            
            await submissionChannel.send({ embeds: [notificationEmbed] });
        }
        
        logger.info(`Match verified: ${matchId} by ${interaction.user.tag}`);
    }
};