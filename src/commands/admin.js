const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands for bot management')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View bot statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Clean up old tickets and matches')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days to keep data')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup bot configuration')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'stats':
                await this.showStats(interaction);
                break;
            case 'cleanup':
                await this.cleanupData(interaction);
                break;
            case 'setup':
                await this.setupGuide(interaction);
                break;
        }
    },
    
    async showStats(interaction) {
        try {
            const stats = await database.getStats();
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📊 ML HUB BOT Statistics')
                .addFields(
                    { name: '🎫 Tickets', value: `Total: ${stats.tickets.total}\nOpen: ${stats.tickets.open}\nClosed: ${stats.tickets.closed}`, inline: true },
                    { name: '🎮 Matches', value: `Total: ${stats.matches.total}\nPending: ${stats.matches.pending}\nVerified: ${stats.matches.verified}`, inline: true },
                    { name: '🖥️ Bot Info', value: `Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\nServing: ${interaction.client.guilds.cache.size} guilds`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: 64 });
        } catch (error) {
            logger.error(`Error getting stats: ${error.message}`);
            await interaction.reply({
                content: '❌ Failed to get statistics. Please try again.',
                flags: 64
            });
        }
    },
    
    async cleanupData(interaction) {
        const days = interaction.options.getInteger('days');
        
        try {
            const result = await database.cleanupOldData(days);
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🧹 Cleanup Complete')
                .setDescription(`Removed data older than ${days} days`)
                .addFields(
                    { name: 'Tickets Removed', value: result.tickets.toString(), inline: true },
                    { name: 'Matches Removed', value: result.matches.toString(), inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: 64 });
            logger.info(`Cleanup completed: ${result.tickets} tickets, ${result.matches} matches removed`);
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
            await interaction.reply({
                content: '❌ Failed to clean up data. Please try again.',
                flags: 64
            });
        }
    },
    
    async setupGuide(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('⚙️ ML HUB BOT Setup Guide')
            .setDescription('Follow these steps to complete the bot setup:')
            .addFields(
                { name: '1. Create Channels', value: 'Create the following channels:\n• #complaints\n• #suggestions\n• #match-submissions' },
                { name: '2. Set Roles', value: 'Create and assign the following roles:\n• Admin\n• Moderator\n• Tournament Manager' },
                { name: '3. Configure .env', value: 'Add the channel and role IDs to your .env file:\n```\nCOMPLAINT_CHANNEL_ID=...\nSUGGESTION_CHANNEL_ID=...\nMATCH_SUBMISSION_CHANNEL_ID=...\nADMIN_ROLE_ID=...\nMOD_ROLE_ID=...\nTOURNAMENT_MANAGER_ROLE_ID=...\n```' },
                { name: '4. Create Ticket Panel', value: 'Use `/ticket panel` to create the ticket system panel in your desired channel' },
                { name: '5. Test Commands', value: 'Test the following commands:\n• `/cointoss`\n• `/match submit`\n• `/ticket create`' }
            )
            .setFooter({ text: 'After setup, restart the bot for changes to take effect' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};