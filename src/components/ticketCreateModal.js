const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: /^ticket_create_modal_(complaint|suggestion|support)$/,
    
    async execute(interaction) {
        const modalType = interaction.customId.split('_').pop();
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const userId = interaction.user.id;
        
        // Check ticket limit
        const openTickets = await database.getUserOpenTickets(userId);
        if (openTickets.length >= config.ticketLimit) {
            return interaction.reply({
                content: `❌ You already have ${openTickets.length} open tickets. Please close some before creating a new one.`,
                flags: 64
            });
        }
        
        // Create ticket ID
        const ticketId = `${modalType}-${Date.now()}-${userId.slice(-4)}`;
        
        // Determine which channel to send to
        let targetChannelId = null;
        let channelName = '';
        
        switch (modalType) {
            case 'complaint':
                targetChannelId = config.complaintChannelId;
                channelName = 'Complaints';
                break;
            case 'suggestion':
                targetChannelId = config.suggestionChannelId;
                channelName = 'Suggestions';
                break;
            case 'support':
                targetChannelId = config.matchSubmissionChannelId;
                channelName = 'Support';
                break;
        }
        
        // Create ticket in database
        const ticketData = {
            ticketId,
            userId,
            userTag: interaction.user.tag,
            type: modalType,
            title,
            description,
            status: 'open',
            createdAt: new Date().toISOString(),
            messages: [{
                userId: interaction.user.id,
                username: interaction.user.username,
                content: description,
                timestamp: new Date().toISOString(),
                attachments: []
            }]
        };
        
        await database.createTicket(ticketData);
        
        // Send to appropriate channel
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (targetChannel) {
            const embedColor = modalType === 'complaint' ? 0xFF0000 : (modalType === 'suggestion' ? 0x00FF00 : 0x0099FF);
            const emoji = modalType === 'complaint' ? '⚠️' : (modalType === 'suggestion' ? '💡' : '🆘');
            
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${emoji} ${modalType.toUpperCase()}: ${title}`)
                .setDescription(description)
                .addFields(
                    { name: 'Ticket ID', value: ticketId, inline: true },
                    { name: 'From', value: interaction.user.tag, inline: true },
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Status', value: 'Open', inline: true }
                )
                .setTimestamp();
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_close_${ticketId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId(`ticket_reply_${ticketId}`)
                        .setLabel('Reply')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💬')
                );
            
            await targetChannel.send({ 
                content: `<@&${config.adminRoleId}> <@&${config.modRoleId}>`,
                embeds: [embed], 
                components: [row] 
            });
            
            await interaction.reply({
                content: `✅ Your ${modalType} has been submitted to #${channelName.toLowerCase()}. Staff will review it shortly.\n**Ticket ID:** \`${ticketId}\``,
                flags: 64
            });
        } else {
            await interaction.reply({
                content: '❌ Could not find the target channel. Please contact an administrator.',
                flags: 64
            });
        }
        
        logger.info(`Ticket created: ${ticketId} by ${interaction.user.tag}`);
    }
};