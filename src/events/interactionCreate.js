const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Log all interactions for debugging
        logger.info(`📨 Interaction received: ${interaction.type} - ${interaction.commandName || interaction.customId || 'unknown'} from ${interaction.user.tag}`);
        
        // Handle slash commands with queue system
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                logger.warn(`⚠️ No command matching ${interaction.commandName} was found.`);
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ 
                        content: '❌ Command not found!', 
                        flags: 64 
                    });
                }
                return;
            }
            
            // Check if we're at capacity
            if (client.activeCommands >= client.maxConcurrentCommands) {
                logger.info(`⏳ Command queueing: ${interaction.commandName} by ${interaction.user.tag}`);
                client.commandQueue.push({ interaction, command });
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ 
                        content: '⏳ Server is busy. Your command is queued and will be processed shortly...', 
                        flags: 64 
                    });
                }
                return;
            }
            
            // Process command immediately
            client.activeCommands++;
            try {
                logger.info(`▶️ Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
                await command.execute(interaction);
                logger.info(`✅ Command completed: ${interaction.commandName} by ${interaction.user.tag}`);
            } catch (error) {
                logger.error(`❌ Error executing ${interaction.commandName}: ${error.message}`);
                logger.error(error.stack);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Error')
                    .setDescription('There was an error executing this command!')
                    .setTimestamp();
                
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
                    } else {
                        await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                    }
                } catch (replyError) {
                    logger.error(`Failed to send error response: ${replyError.message}`);
                }
            } finally {
                client.activeCommands--;
                client.processQueue();
            }
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            // Check if already handled to prevent double processing
            if (interaction.replied || interaction.deferred) {
                logger.warn(`⚠️ Button ${interaction.customId} was already handled, skipping`);
                return;
            }
            
            let buttonHandler = client.buttonHandlers?.get(interaction.customId);
            
            if (!buttonHandler) {
                for (const [pattern, handler] of client.buttonHandlers) {
                    if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                        buttonHandler = handler;
                        break;
                    }
                }
            }
            
            if (buttonHandler) {
                try {
                    logger.info(`🔘 Handling button: ${interaction.customId} by ${interaction.user.tag}`);
                    await buttonHandler(interaction);
                    logger.info(`✅ Button handled: ${interaction.customId}`);
                } catch (error) {
                    logger.error(`❌ Error handling button ${interaction.customId}: ${error.message}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ 
                            content: 'There was an error processing this action!', 
                            flags: 64 
                        });
                    }
                }
            } else {
                logger.warn(`⚠️ No handler found for button: ${interaction.customId}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'This button is not configured properly. Please contact an administrator.', 
                        flags: 64 
                    });
                }
            }
        }
        
        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            // Check if already handled to prevent double processing
            if (interaction.replied || interaction.deferred) {
                logger.warn(`⚠️ Modal ${interaction.customId} was already handled, skipping`);
                return;
            }
            
            let modalHandler = client.modalHandlers?.get(interaction.customId);
            
            if (!modalHandler) {
                for (const [pattern, handler] of client.modalHandlers) {
                    if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                        modalHandler = handler;
                        break;
                    }
                }
            }
            
            if (modalHandler) {
                try {
                    logger.info(`📝 Handling modal: ${interaction.customId} by ${interaction.user.tag}`);
                    await modalHandler(interaction);
                    logger.info(`✅ Modal handled: ${interaction.customId}`);
                } catch (error) {
                    logger.error(`❌ Error handling modal ${interaction.customId}: ${error.message}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ 
                            content: 'There was an error submitting this form!', 
                            flags: 64 
                        });
                    }
                }
            } else {
                logger.warn(`⚠️ No handler found for modal: ${interaction.customId}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'This form is not configured properly. Please contact an administrator.', 
                        flags: 64 
                    });
                }
            }
        }
        
        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    logger.error(`❌ Error handling autocomplete ${interaction.commandName}: ${error.message}`);
                }
            }
        }
    }
};