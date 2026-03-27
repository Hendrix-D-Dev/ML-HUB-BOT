const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    
    async execute(interaction) {
        logger.info(`Ping command executed by ${interaction.user.tag}`);
        await interaction.reply({ 
            content: `Pong! 🏓\nLatency: ${Date.now() - interaction.createdTimestamp}ms`,
            flags: 64 
        });
    }
};