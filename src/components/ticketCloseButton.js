const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^ticket_close_.+$/,
    
    async execute(interaction) {
        // Defer the reply immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });
        
        const ticketId = interaction.customId.replace('ticket_close_', '');
        
        const ticket = await database.getTicket(ticketId);
        if (!ticket) {
            return interaction.editReply({
                content: '❌ Ticket not found!'
            });
        }
        
        // Check if user has permission to close
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isOwner = ticket.userId === interaction.user.id;
        
        if (!isOwner && !isAdmin && !isMod) {
            return interaction.editReply({
                content: '❌ You don\'t have permission to close this ticket!'
            });
        }
        
        if (ticket.status === 'closed') {
            return interaction.editReply({
                content: '❌ This ticket is already closed!'
            });
        }
        
        // Create modal for close reason
        const modal = new ModalBuilder()
            .setCustomId(`ticket_close_modal_${ticketId}`)
            .setTitle('Close Ticket');
        
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for closing')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Optional: Provide a reason for closing this ticket')
            .setRequired(false);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        
        // Show the modal - this will replace the defer reply
        await interaction.showModal(modal);
        
        logger.info(`Close ticket modal shown for: ${ticketId} by ${interaction.user.tag}`);
    }
};