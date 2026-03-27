const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'messageCreate',
    async execute(message, client) {
        // Ignore bot messages and non-thread messages
        if (message.author.bot) return;
        if (!message.channel.isThread()) return;
        
        // Check if this thread is for match screenshots
        const threadName = message.channel.name;
        if (!threadName.startsWith('📸 Screenshots for ML-')) return;
        
        // Extract match ID from thread name
        const matchId = threadName.replace('📸 Screenshots for ', '');
        
        // Check if user is the match submitter or staff
        const match = await database.getMatch(matchId);
        if (!match) return;
        
        const isSubmitter = match.submittedBy.userId === message.author.id;
        const isStaff = message.member.roles.cache.has(config.adminRoleId) || 
                        message.member.roles.cache.has(config.modRoleId) ||
                        message.member.roles.cache.has(config.tournamentManagerRoleId);
        
        // Only submitter and staff can upload screenshots
        if (!isSubmitter && !isStaff) {
            await message.delete();
            return message.author.send(`❌ You don't have permission to upload screenshots for match **${matchId}**. Only the match submitter can upload screenshots.`);
        }
        
        // Check if message has attachments
        if (message.attachments.size === 0) {
            // If no attachments, inform the user
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ No Screenshot Detected')
                .setDescription('Please upload an image file (PNG, JPG, GIF, etc.) as an attachment.')
                .setTimestamp();
            
            return message.reply({ embeds: [warningEmbed] });
        }
        
        // Process screenshots
        const screenshotUrls = [];
        message.attachments.forEach(attachment => {
            if (attachment.contentType?.startsWith('image/')) {
                screenshotUrls.push(attachment.url);
            }
        });
        
        if (screenshotUrls.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Invalid File Type')
                .setDescription('Only image files are accepted for match screenshots.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Add screenshots to match
        const currentScreenshots = match.screenshots || [];
        const updatedScreenshots = [...currentScreenshots, ...screenshotUrls];
        await database.updateMatch(matchId, { screenshots: updatedScreenshots });
        
        // Create confirmation embed
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Screenshot(s) Added')
            .setDescription(`${screenshotUrls.length} screenshot(s) have been added to match **${matchId}**`)
            .addFields(
                { name: 'Total Screenshots', value: updatedScreenshots.length.toString(), inline: true },
                { name: 'Status', value: match.status.toUpperCase(), inline: true }
            )
            .setTimestamp();
        
        // Add links to screenshots
        if (screenshotUrls.length === 1) {
            confirmEmbed.addFields({ name: '📸 Screenshot', value: `[View Image](${screenshotUrls[0]})`, inline: false });
        } else {
            const links = screenshotUrls.map((url, i) => `[Screenshot ${i + 1}](${url})`).join(' • ');
            confirmEmbed.addFields({ name: '📸 Screenshots', value: links, inline: false });
        }
        
        await message.reply({ embeds: [confirmEmbed] });
        
        // Update the original match message in submission channel
        const submissionChannel = message.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                
                // Update embed with screenshot count
                const screenshotField = originalEmbed.data.fields?.find(f => f.name === '📸 Screenshots');
                if (screenshotField) {
                    screenshotField.value = `${updatedScreenshots.length} screenshot(s) uploaded`;
                } else {
                    originalEmbed.addFields({ name: '📸 Screenshots', value: `${updatedScreenshots.length} screenshot(s) uploaded`, inline: false });
                }
                
                await originalMessage.edit({ embeds: [originalEmbed] });
                
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
            }
        }
        
        // If this is the submitter, notify staff that screenshots are ready
        if (isSubmitter && !match.staffNotified) {
            await database.updateMatch(matchId, { staffNotified: true });
            
            const staffEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📸 New Match Screenshots')
                .setDescription(`Match **${matchId}** now has ${updatedScreenshots.length} screenshot(s) uploaded and is ready for review.`)
                .addFields(
                    { name: 'Squads', value: `${match.squad1.name} vs ${match.squad2.name}`, inline: true },
                    { name: 'Score', value: `${match.squad1.score} - ${match.squad2.score}`, inline: true },
                    { name: 'Submitter', value: match.submittedBy.username, inline: true }
                )
                .setTimestamp();
            
            if (submissionChannel) {
                await submissionChannel.send({ 
                    content: `<@&${config.tournamentManagerRoleId}> <@&${config.adminRoleId}>`,
                    embeds: [staffEmbed]
                });
            }
        }
        
        logger.info(`${screenshotUrls.length} screenshots added to match: ${matchId} by ${message.author.tag}`);
        
        // Clean up the user's message to keep thread clean
        await message.delete();
        
        // Send a clean confirmation message
        const cleanConfirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Screenshot Added')
            .setDescription(`${screenshotUrls.length} screenshot(s) have been added to match **${matchId}**`)
            .setTimestamp();
        
        await message.channel.send({ embeds: [cleanConfirmEmbed] });
    }
};