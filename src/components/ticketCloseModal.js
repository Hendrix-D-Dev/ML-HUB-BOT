const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: /^ticket_close_modal_.+$/,
    
    async execute(interaction) {
        // Defer the reply for the modal - this is important!
        await interaction.deferReply({ flags: 64 });
        
        const ticketId = interaction.customId.replace('ticket_close_modal_', '');
        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        
        const ticket = await database.getTicket(ticketId);
        if (!ticket) {
            return interaction.editReply({
                content: '❌ Ticket not found!'
            });
        }
        
        // Update ticket status
        await database.updateTicket(ticketId, {
            status: 'closed',
            closedAt: new Date().toISOString(),
            closedBy: interaction.user.id,
            closeReason: reason
        });
        
        // Update the original message
        let targetChannelId = null;
        switch (ticket.type) {
            case 'complaint':
                targetChannelId = config.complaintChannelId;
                break;
            case 'suggestion':
                targetChannelId = config.suggestionChannelId;
                break;
            case 'support':
                targetChannelId = config.ticketChannelId || config.ticketCategoryId;
                break;
        }
        
        if (targetChannelId) {
            const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (targetChannel) {
                // Try to find the original message
                try {
                    const messages = await targetChannel.messages.fetch({ limit: 50 });
                    const ticketMessage = messages.find(m => 
                        m.embeds[0]?.fields?.some(f => f.value === ticketId)
                    );
                    
                    if (ticketMessage) {
                        const originalEmbed = EmbedBuilder.from(ticketMessage.embeds[0]);
                        originalEmbed.setColor(0xFF0000);
                        originalEmbed.addFields(
                            { name: '🔒 Closed By', value: interaction.user.tag, inline: true },
                            { name: '📝 Close Reason', value: reason, inline: true },
                            { name: '📅 Closed At', value: new Date().toLocaleString(), inline: true }
                        );
                        
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`ticket_closed_${ticketId}`)
                                    .setLabel('Closed')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            );
                        
                        await ticketMessage.edit({ embeds: [originalEmbed], components: [row] });
                    }
                } catch (error) {
                    logger.error(`Error updating ticket message: ${error.message}`);
                }
            }
        }
        
        // Send success message
        await interaction.editReply({
            content: `✅ Ticket **${ticketId}** has been closed.`
        });
        
        logger.info(`Ticket closed via button: ${ticketId} by ${interaction.user.tag}`);
    }
};