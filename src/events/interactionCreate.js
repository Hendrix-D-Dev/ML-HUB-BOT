const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (!command) {
                logger.warn(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            try {
                await command.execute(interaction);
                logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.tag}`);
            } catch (error) {
                logger.error(`Error executing ${interaction.commandName}: ${error.message}`);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Error')
                    .setDescription('There was an error executing this command!')
                    .setTimestamp();
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                }
            }
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            // Check for exact match first
            let buttonHandler = interaction.client.buttonHandlers?.get(interaction.customId);
            
            // If no exact match, check regex patterns
            if (!buttonHandler) {
                for (const [pattern, handler] of interaction.client.buttonHandlers) {
                    if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                        buttonHandler = handler;
                        break;
                    }
                }
            }
            
            if (buttonHandler) {
                try {
                    await buttonHandler(interaction);
                    logger.info(`Button handled: ${interaction.customId} by ${interaction.user.tag}`);
                } catch (error) {
                    logger.error(`Error handling button ${interaction.customId}: ${error.message}`);
                    if (!interaction.replied) {
                        await interaction.reply({ 
                            content: 'There was an error processing this action!', 
                            flags: 64 
                        });
                    }
                }
            } else {
                logger.warn(`No handler found for button: ${interaction.customId}`);
            }
        }
        
        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            // Check for exact match first
            let modalHandler = interaction.client.modalHandlers?.get(interaction.customId);
            
            // If no exact match, check regex patterns
            if (!modalHandler) {
                for (const [pattern, handler] of interaction.client.modalHandlers) {
                    if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                        modalHandler = handler;
                        break;
                    }
                }
            }
            
            if (modalHandler) {
                try {
                    await modalHandler(interaction);
                    logger.info(`Modal handled: ${interaction.customId} by ${interaction.user.tag}`);
                } catch (error) {
                    logger.error(`Error handling modal ${interaction.customId}: ${error.message}`);
                    if (!interaction.replied) {
                        await interaction.reply({ 
                            content: 'There was an error submitting this form!', 
                            flags: 64 
                        });
                    }
                }
            } else {
                logger.warn(`No handler found for modal: ${interaction.customId}`);
            }
        }
        
        // Handle autocomplete interactions (if needed)
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    logger.error(`Error handling autocomplete ${interaction.commandName}: ${error.message}`);
                }
            }
        }
    }
};