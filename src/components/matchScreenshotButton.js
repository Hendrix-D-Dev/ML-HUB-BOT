const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_add_screenshot_.+$/,
    
    async execute(interaction) {
        const matchId = interaction.customId.replace('match_add_screenshot_', '');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        // Create modal for screenshot URL
        const modal = new ModalBuilder()
            .setCustomId(`match_screenshot_modal_${matchId}`)
            .setTitle('Add Match Screenshot');
        
        const screenshotInput = new TextInputBuilder()
            .setCustomId('screenshot_url')
            .setLabel('Screenshot URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Paste the image URL here (Imgur, Discord CDN, etc.)')
            .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(screenshotInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
};