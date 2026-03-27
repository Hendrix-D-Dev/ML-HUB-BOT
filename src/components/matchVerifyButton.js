const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_verify_.+$/,
    
    async execute(interaction) {
        // Defer reply immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_verify_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.editReply({
                content: '❌ Match not found!'
            });
        }
        
        // Check if user has admin or mod permissions
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isTournamentManager = interaction.member.roles.cache.has(config.tournamentManagerRoleId);
        
        if (!isAdmin && !isMod && !isTournamentManager) {
            return interaction.editReply({
                content: '❌ You don\'t have permission to verify matches!'
            });
        }
        
        if (match.status === 'verified') {
            return interaction.editReply({
                content: '❌ This match is already verified!'
            });
        }
        
        if (match.status === 'rejected') {
            return interaction.editReply({
                content: '❌ This match has already been rejected!'
            });
        }
        
        // Prepare screenshot links for display
        const screenshotLinks = (match.screenshots || []).map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
        const screenshotDisplay = match.screenshots?.length > 0 ? screenshotLinks : 'No screenshots uploaded';
        
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
                originalEmbed.setFooter({ text: `Verified on ${new Date().toLocaleString()}` });
                
                // Update screenshot field if exists
                const existingField = originalEmbed.data.fields?.find(f => f.name === '📸 Screenshots');
                if (existingField) {
                    existingField.value = screenshotDisplay;
                } else if (match.screenshots?.length > 0) {
                    originalEmbed.addFields({ name: '📸 Screenshots', value: screenshotDisplay, inline: false });
                }
                
                // Disable buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_verify_${matchId}`)
                            .setLabel('✅ Verified')
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
        
        // Close the private thread if it exists
        if (match.threadId) {
            try {
                const thread = await interaction.guild.channels.fetch(match.threadId);
                if (thread && thread.isThread()) {
                    await thread.setLocked(true);
                    await thread.setArchived(true);
                    await thread.send({ 
                        content: `🔒 This thread has been archived because the match has been verified by ${interaction.user.tag}.`
                    });
                }
            } catch (error) {
                logger.error(`Error archiving thread: ${error.message}`);
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
                { name: 'Winner', value: match.winner, inline: true },
                { name: '📸 Screenshots', value: `${match.screenshots?.length || 0} screenshot(s) uploaded`, inline: true }
            )
            .setTimestamp();
        
        if (match.screenshots?.length > 0) {
            const firstScreenshot = match.screenshots[0];
            confirmEmbed.setImage(firstScreenshot);
            confirmEmbed.addFields({ name: '🔗 View All Screenshots', value: screenshotLinks, inline: false });
        }
        
        await interaction.editReply({ embeds: [confirmEmbed] });
        
        // Also notify in the match submission channel
        if (submissionChannel) {
            const notificationEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Match Verified')
                .setDescription(`Match **${matchId}** has been verified by ${interaction.user.tag}`)
                .addFields(
                    { name: 'Screenshots', value: `${match.screenshots?.length || 0} screenshot(s) uploaded`, inline: true }
                )
                .setTimestamp();
            
            await submissionChannel.send({ embeds: [notificationEmbed] });
        }
        
        logger.info(`Match verified: ${matchId} by ${interaction.user.tag}`);
    }
};