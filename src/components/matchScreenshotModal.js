const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: /^match_screenshot_modal_.+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace('match_screenshot_modal_', '');
        const screenshotUrl = interaction.fields.getTextInputValue('screenshot_url');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Add screenshot to match
        const screenshots = [...(match.screenshots || []), screenshotUrl];
        await database.updateMatch(matchId, { screenshots });
        
        // Update the original message
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const message = await submissionChannel.messages.fetch(match.messageId);
                
                const embed = EmbedBuilder.from(message.embeds[0]);
                
                // Update embed with screenshots
                if (screenshots.length > 0) {
                    const screenshotField = embed.data.fields?.find(f => f.name === '📸 Screenshots');
                    if (screenshotField) {
                        screenshotField.value = screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                    } else {
                        embed.addFields({ name: '📸 Screenshots', value: screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n'), inline: false });
                    }
                }
                
                await message.edit({ embeds: [embed] });
                
                await interaction.reply({
                    content: `✅ Screenshot added to match **${matchId}**!`,
                    flags: 64
                });
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
                await interaction.reply({
                    content: `✅ Screenshot added to match **${matchId}**! (Couldn't update the message, but the screenshot is saved)`,
                    flags: 64
                });
            }
        } else {
            await interaction.reply({
                content: `✅ Screenshot added to match **${matchId}**!`,
                flags: 64
            });
        }
        
        logger.info(`Screenshot added to match: ${matchId} by ${interaction.user.tag}`);
    }
};