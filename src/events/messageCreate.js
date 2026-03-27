const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('../utils/database');
const cloudinary = require('../utils/cloudinary');

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
                
                // Show uploading status
                const uploadingEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📤 Uploading to Cloudinary')
                    .setDescription(`Uploading ${message.attachments.size} screenshot(s) to permanent cloud storage...\n\n*Cloudinary free tier: 25GB storage, 25GB monthly bandwidth*`)
                    .setTimestamp();
                
                await message.reply({ embeds: [uploadingEmbed] });
                
                // Process screenshots
                const tempUrls = [];
                
                message.attachments.forEach(attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        tempUrls.push(attachment.url);
                    }
                });
                
                if (tempUrls.length === 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Invalid File Type')
                        .setDescription('Only image files are accepted for match screenshots.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Upload to Cloudinary
                const uploadedUrls = await cloudinary.uploadMultipleScreenshots(tempUrls, matchId);
                
                if (uploadedUrls.length === 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Upload Failed')
                        .setDescription('Failed to upload screenshots to Cloudinary. Please try again.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Add screenshots to match in database
                const currentScreenshots = match.screenshots || [];
                const updatedScreenshots = [...currentScreenshots, ...uploadedUrls];
                await database.updateMatchScreenshots(matchId, updatedScreenshots);
                
                // Create a confirmation embed with the actual images
                const confirmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Screenshot(s) Added Permanently')
                    .setDescription(`${uploadedUrls.length} screenshot(s) have been permanently stored in Cloudinary for match **${matchId}**`)
                    .addFields(
                        { name: 'Total Screenshots', value: updatedScreenshots.length.toString(), inline: true },
                        { name: 'Status', value: match.status.toUpperCase(), inline: true },
                        { name: 'Storage', value: '☁️ Cloudinary (25GB free)', inline: true }
                    )
                    .setTimestamp();
                
                // Add the actual images to the embed
                if (uploadedUrls.length === 1) {
                    confirmEmbed.setImage(uploadedUrls[0]);
                    confirmEmbed.addFields({ name: '📸 Screenshot', value: `[Click to view full size](${uploadedUrls[0]})`, inline: false });
                } else {
                    // For multiple images, create a gallery-like display
                    const imageFields = uploadedUrls.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                    confirmEmbed.addFields({ name: '📸 Screenshots Uploaded', value: imageFields, inline: false });
                    confirmEmbed.setImage(uploadedUrls[0]);
                    confirmEmbed.addFields({ name: 'ℹ️ Preview', value: `Showing first screenshot. Click the links above to view all ${uploadedUrls.length} screenshots.`, inline: false });
                }
                
                await message.reply({ embeds: [confirmEmbed] });
                
                // Update the original match message in submission channel
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
                            existingField.value = `${updatedScreenshots.length} screenshot(s) uploaded (Cloudinary)\n${screenshotDisplay}`;
                        } else {
                            originalEmbed.addFields({ 
                                name: '📸 Screenshots', 
                                value: `${updatedScreenshots.length} screenshot(s) uploaded (Cloudinary)\n${screenshotDisplay}`, 
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
                    .setTitle('📸 Uploaded Screenshots (Cloudinary)')
                    .setDescription(`Here are the permanently stored screenshots for match **${matchId}**:\n\n*These links will never expire!*`)
                    .addFields(
                        { name: 'Storage Info', value: '☁️ Cloudinary Free Tier: 25GB storage • 25GB monthly bandwidth • Auto-optimized', inline: false }
                    )
                    .setTimestamp();
                
                if (uploadedUrls.length === 1) {
                    screenshotDisplayEmbed.setImage(uploadedUrls[0]);
                } else {
                    const imageLinks = uploadedUrls.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
                    screenshotDisplayEmbed.addFields({ name: 'Screenshots', value: imageLinks, inline: false });
                    screenshotDisplayEmbed.setImage(uploadedUrls[0]);
                    screenshotDisplayEmbed.addFields({ name: 'ℹ️ Note', value: `Showing preview of first screenshot. Click the links above to view all ${uploadedUrls.length} screenshots.`, inline: false });
                }
                
                await message.channel.send({ embeds: [screenshotDisplayEmbed] });
                
                // Delete the user's original message to keep thread clean
                await message.delete();
                
                logger.info(`${uploadedUrls.length} screenshots permanently stored in Cloudinary for match: ${matchId} by ${message.author.tag}`);
            }
        }
        
        // Handle complaint channel messages (keep existing code)
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
        
        // Handle suggestion channel messages (keep existing code)
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