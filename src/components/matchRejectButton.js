const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_reject_.+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace('match_reject_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Check if user has admin or mod permissions
        const isAdmin = interaction.memberPermissions.has('Administrator');
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        const isTournamentManager = interaction.member.roles.cache.has(config.tournamentManagerRoleId);
        
        if (!isAdmin && !isMod && !isTournamentManager) {
            return interaction.reply({
                content: '❌ You don\'t have permission to reject matches!',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified!',
                flags: 64
            });
        }
        
        if (match.status === 'rejected') {
            return interaction.reply({
                content: '❌ This match is already rejected!',
                flags: 64
            });
        }
        
        // Create modal for rejection reason
        const modal = new ModalBuilder()
            .setCustomId(`match_reject_modal_${matchId}`)
            .setTitle('Reject Match');
        
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for rejection')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Please provide a reason for rejecting this match')
            .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
};