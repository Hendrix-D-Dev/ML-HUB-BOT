const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    type: 'button',
    customId: 'ticket_complaint',
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('ticket_create_modal')
            .setTitle('Create a Complaint');
        
        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Brief title for your complaint')
            .setRequired(true);
        
        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Detailed description of your complaint')
            .setRequired(true);
        
        const row1 = new ActionRowBuilder().addComponents(titleInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);
        
        modal.addComponents(row1, row2);
        
        // Store type in a custom state
        interaction.client.tempData = interaction.client.tempData || {};
        interaction.client.tempData[interaction.user.id] = { type: 'complaint' };
        
        await interaction.showModal(modal);
    }
};

// Create separate handlers for different ticket types
module.exports = [
    {
        type: 'button',
        customId: 'ticket_complaint',
        async execute(interaction) {
            const modal = new ModalBuilder()
                .setCustomId('ticket_create_modal_complaint')
                .setTitle('Create a Complaint');
            
            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Brief title for your complaint')
                .setRequired(true);
            
            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Detailed description of your complaint')
                .setRequired(true);
            
            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);
            
            modal.addComponents(row1, row2);
            
            await interaction.showModal(modal);
        }
    },
    {
        type: 'button',
        customId: 'ticket_suggestion',
        async execute(interaction) {
            const modal = new ModalBuilder()
                .setCustomId('ticket_create_modal_suggestion')
                .setTitle('Create a Suggestion');
            
            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Brief title for your suggestion')
                .setRequired(true);
            
            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Detailed description of your suggestion')
                .setRequired(true);
            
            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);
            
            modal.addComponents(row1, row2);
            
            await interaction.showModal(modal);
        }
    },
    {
        type: 'button',
        customId: 'ticket_support',
        async execute(interaction) {
            const modal = new ModalBuilder()
                .setCustomId('ticket_create_modal_support')
                .setTitle('Create a Support Request');
            
            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Brief title for your support request')
                .setRequired(true);
            
            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe your issue or question')
                .setRequired(true);
            
            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);
            
            modal.addComponents(row1, row2);
            
            await interaction.showModal(modal);
        }
    }
];