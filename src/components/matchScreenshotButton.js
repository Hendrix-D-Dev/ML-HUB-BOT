const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_screenshot_(user_)?[A-Za-z0-9\-]+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace(/^match_screenshot_(user_)?/, '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Create a collector for file uploads
        const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
        const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 5 });
        
        let screenshotCount = 0;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📸 Upload Match Screenshots')
            .setDescription(`Please upload your match screenshots for match **${matchId}**.\n\nYou have 60 seconds to upload up to 5 screenshots.\n\n**Squad 1:** ${match.squad1.name} (${match.squad1.score})\n**Squad 2:** ${match.squad2.name} (${match.squad2.score})`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        
        collector.on('collect', async (message) => {
            const attachments = message.attachments;
            const screenshotUrls = [];
            
            attachments.forEach(attachment => {
                if (attachment.contentType?.startsWith('image/')) {
                    screenshotUrls.push(attachment.url);
                }
            });
            
            if (screenshotUrls.length > 0) {
                const currentScreenshots = match.screenshots || [];
                const updatedScreenshots = [...currentScreenshots, ...screenshotUrls];
                await database.updateMatch(matchId, { screenshots: updatedScreenshots });
                screenshotCount += screenshotUrls.length;
                
                await message.reply(`✅ Screenshot ${screenshotCount}/${collector.max} added!`);
                
                // Update the original match message in submission channel
                const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
                if (submissionChannel && match.messageId) {
                    try {
                        const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                        const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                        
                        // Update embed with screenshots
                        if (updatedScreenshots.length > 0) {
                            const screenshotField = originalEmbed.data.fields?.find(f => f.name === '📸 Screenshots');
                            if (screenshotField) {
                                screenshotField.value = updatedScreenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                            } else {
                                originalEmbed.addFields({ name: '📸 Screenshots', value: updatedScreenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n'), inline: false });
                            }
                            await originalMessage.edit({ embeds: [originalEmbed] });
                        }
                    } catch (error) {
                        logger.error(`Error updating match message: ${error.message}`);
                    }
                }
            }
        });
        
        collector.on('end', async (collected) => {
            const finalMatch = await database.getMatch(matchId);
            const finalEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Screenshot Upload Complete')
                .setDescription(`**${screenshotCount}** screenshot(s) added to match **${matchId}**`)
                .addFields(
                    { name: 'Total Screenshots', value: (finalMatch.screenshots?.length || 0).toString(), inline: true },
                    { name: 'Status', value: finalMatch.status.toUpperCase(), inline: true }
                )
                .setTimestamp();
            
            if (finalMatch.screenshots?.length > 0) {
                finalEmbed.addFields({ name: '📸 Uploaded Screenshots', value: finalMatch.screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n'), inline: false });
            }
            
            await interaction.followUp({ embeds: [finalEmbed], flags: 64 });
            logger.info(`${screenshotCount} screenshots added to match: ${matchId}`);
        });
    }
};