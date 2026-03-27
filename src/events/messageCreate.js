const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages
        if (message.author.bot) return;
        
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
            
            // Log to admin channel or send notification
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
            
            // Add reaction buttons for voting
            await message.react('👍');
            await message.react('👎');
            
            // Send notification
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