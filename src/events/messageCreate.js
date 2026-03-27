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
                const matchId = threadName.replace('📸 Screenshots for ', '');
                
                const match = await database.getMatch(matchId);
                if (!match) return;
                
                const isSubmitter = match.submittedBy.userId === message.author.id;
                const isStaff = message.member.roles.cache.has(config.adminRoleId) || 
                                message.member.roles.cache.has(config.modRoleId) ||
                                message.member.roles.cache.has(config.tournamentManagerRoleId);
                
                if (!isSubmitter && !isStaff) {
                    await message.delete();
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Permission Denied')
                        .setDescription('Only the match submitter can upload screenshots.')
                        .setTimestamp();
                    
                    return message.author.send({ embeds: [errorEmbed] });
                }
                
                if (message.attachments.size === 0) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('⚠️ No Screenshot')
                        .setDescription('Please upload an image file.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [warningEmbed] });
                }
                
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
                        .setDescription('Only image files are accepted.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Upload screenshots
                const uploadedUrls = await cloudinary.uploadMultipleScreenshots(tempUrls, matchId);
                
                if (uploadedUrls.length === 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Upload Failed')
                        .setDescription('Failed to upload screenshots. Please try again.')
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Add screenshots to match
                const currentScreenshots = match.screenshots || [];
                const updatedScreenshots = [...currentScreenshots, ...uploadedUrls];
                await database.updateMatchScreenshots(matchId, updatedScreenshots);
                
                // Simple confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Screenshot Added')
                    .setDescription(`${uploadedUrls.length} screenshot(s) added to match **${matchId}**`)
                    .setTimestamp();
                
                await message.reply({ embeds: [confirmEmbed] });
                
                // Update the original match message
                const submissionChannel = message.guild.channels.cache.get(config.matchSubmissionChannelId);
                if (submissionChannel && match.messageId) {
                    try {
                        const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                        const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                        
                        const existingField = originalEmbed.data.fields?.find(f => f.name === '📸 Screenshots');
                        if (existingField) {
                            existingField.value = `${updatedScreenshots.length} screenshot(s) uploaded`;
                        } else {
                            originalEmbed.addFields({ 
                                name: '📸 Screenshots', 
                                value: `${updatedScreenshots.length} screenshot(s) uploaded`, 
                                inline: false 
                            });
                        }
                        
                        await originalMessage.edit({ embeds: [originalEmbed] });
                    } catch (error) {
                        logger.error(`Error updating match message: ${error.message}`);
                    }
                }
                
                // Delete user's message to keep thread clean
                await message.delete();
                
                logger.info(`${uploadedUrls.length} screenshots added to match: ${matchId} by ${message.author.tag}`);
            }
        }
        
        // Handle complaint channel messages
        if (message.channel.id === config.complaintChannelId) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('📢 New Complaint')
                .setDescription(message.content)
                .addFields(
                    { name: 'From', value: message.author.tag, inline: true }
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
                    { name: 'From', value: message.author.tag, inline: true }
                )
                .setTimestamp();
            
            await message.react('👍');
            await message.react('👎');
            
            const adminRole = message.guild.roles.cache.get(config.adminRoleId);
            if (adminRole) {
                await message.channel.send({
                    content: `${adminRole}`,
                    embeds: [embed]
                });
            }
            
            logger.info(`New suggestion from ${message.author.tag}`);
        }
    }
};