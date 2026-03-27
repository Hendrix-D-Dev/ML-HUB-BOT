const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^ticket_close_.+$/,
    
    async execute(interaction) {
        const ticketId = interaction.customId.replace('ticket_close_', '');
        
        const ticket = await database.getTicket(ticketId);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Ticket not found!',
                flags: 64
            });
        }
        
        // Check if user has permission to close
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isOwner = ticket.userId === interaction.user.id;
        
        if (!isOwner && !isAdmin && !isMod) {
            return interaction.reply({
                content: '❌ You don\'t have permission to close this ticket!',
                flags: 64
            });
        }
        
        if (ticket.status === 'closed') {
            return interaction.reply({
                content: '❌ This ticket is already closed!',
                flags: 64
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
        
        await interaction.showModal(modal);
    }
};