const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('../utils/database');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Handle screenshot collection in threads
        if (message.channel.isThread()) {
            const threadName = message.channel.name;
            if (threadName.startsWith('📸 Screenshots for ML-')) {
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
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Permission Denied')
                        .setDescription(`Only the match submitter can upload screenshots for match **${matchId}**.`)
                        .setTimestamp();
                    
                    return message.author.send({ embeds: [errorEmbed] });
                }
                
                // Check if message has attachments
                if (message.attachments.size === 0) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('⚠️ No Screenshot Detected')
                        .setDescription('Please upload an image file (PNG, JPG, GIF, etc.) as an attachment.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [warningEmbed] });
                }
                
                // Process screenshots
                const screenshotUrls = [];
                const screenshotAttachments = [];
                
                message.attachments.forEach(attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        screenshotUrls.push(attachment.url);
                        screenshotAttachments.push({
                            url: attachment.url,
                            name: attachment.name,
                            size: attachment.size
                        });
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
                
                // Add screenshots to match in database
                const currentScreenshots = match.screenshots || [];
                const updatedScreenshots = [...currentScreenshots, ...screenshotUrls];
                await database.updateMatch(matchId, { screenshots: updatedScreenshots });
                
                // Create a confirmation embed with the actual images
                const confirmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Screenshot(s) Added')
                    .setDescription(`${screenshotUrls.length} screenshot(s) have been added to match **${matchId}**`)
                    .addFields(
                        { name: 'Total Screenshots', value: updatedScreenshots.length.toString(), inline: true },
                        { name: 'Status', value: match.status.toUpperCase(), inline: true }
                    )
                    .setTimestamp();
                
                // Add the actual images to the embed if there's only one
                if (screenshotUrls.length === 1) {
                    confirmEmbed.setImage(screenshotUrls[0]);
                    confirmEmbed.addFields({ name: '📸 Screenshot', value: `[Click to view full size](${screenshotUrls[0]})`, inline: false });
                } else {
                    const links = screenshotUrls.map((url, i) => `[Screenshot ${i + 1}](${url})`).join(' • ');
                    confirmEmbed.addFields({ name: '📸 Screenshots Uploaded', value: links, inline: false });
                }
                
                await message.reply({ embeds: [confirmEmbed] });
                
                // Update the original match message in submission channel to show screenshots
                const submissionChannel = message.guild.channels.cache.get(config.matchSubmissionChannelId);
                if (submissionChannel && match.messageId) {
                    try {
                        const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                        const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                        
                        // Create a field with clickable screenshot links
                        let screenshotDisplay = '';
                        if (updatedScreenshots.length === 1) {
                            screenshotDisplay = `[View Screenshot](${updatedScreenshots[0]})`;
                        } else {
                            screenshotDisplay = updatedScreenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                        }
                        
                        // Update or add screenshot field
                        const existingField = originalEmbed.data.fields?.find(f => f.name === '📸 Screenshots');
                        if (existingField) {
                            existingField.value = `${updatedScreenshots.length} screenshot(s) uploaded\n${screenshotDisplay}`;
                        } else {
                            originalEmbed.addFields({ 
                                name: '📸 Screenshots', 
                                value: `${updatedScreenshots.length} screenshot(s) uploaded\n${screenshotDisplay}`, 
                                inline: false 
                            });
                        }
                        
                        await originalMessage.edit({ embeds: [originalEmbed] });
                        
                    } catch (error) {
                        logger.error(`Error updating match message: ${error.message}`);
                    }
                }
                
                // Send a message in the private thread showing the uploaded screenshots
                const screenshotDisplayEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('📸 Uploaded Screenshots')
                    .setDescription(`Here are the screenshots uploaded for match **${matchId}**:`)
                    .setTimestamp();
                
                if (screenshotUrls.length === 1) {
                    screenshotDisplayEmbed.setImage(screenshotUrls[0]);
                } else {
                    const imageLinks = screenshotUrls.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                    screenshotDisplayEmbed.addFields({ name: 'Screenshots', value: imageLinks, inline: false });
                }
                
                await message.channel.send({ embeds: [screenshotDisplayEmbed] });
                
                // Delete the user's original message to keep thread clean
                await message.delete();
                
                logger.info(`${screenshotUrls.length} screenshots added to match: ${matchId} by ${message.author.tag}`);
            }
        }
        
        // Handle complaint channel messages
        if (message.channel.id === config.complaintChannelId) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('📢 New Complaint')
                .setDescription(message.content)
                .addFields(
                    { name: 'From', value: message.author.tag, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
                )
                .setTimestamp();
            
            const adminRole = message.guild.roles.cache.get(config.adminRoleId);
            if (adminRole) {
                await message.channel.send({
                    content: `${adminRole}`,
                    embeds: [embed]
                });
            }
            
            logger.info(`New complaint from ${message.author.tag}`);
        }
        
        // Handle suggestion channel messages
        if (message.channel.id === config.suggestionChannelId) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💡 New Suggestion')
                .setDescription(message.content)
                .addFields(
                    { name: 'From', value: message.author.tag, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
                )
                .setTimestamp();
            
            await message.react('👍');
            await message.react('👎');
            
            const adminRole = message.guild.roles.cache.get(config.adminRoleId);
            if (adminRole) {
                await message.channel.send({
                    content: `${adminRole} New suggestion received!`,
                    embeds: [embed]
                });
            }
            
            logger.info(`New suggestion from ${message.author.tag}`);
        }
    }
};