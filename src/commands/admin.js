const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const database = require('../utils/database');
const featureManager = require('../services/featureManager');
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
                .setDescription('Setup bot configuration'))
        .addSubcommandGroup(group =>
            group
                .setName('livestream')
                .setDescription('Manage YouTube livestream notifications')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Check livestream monitoring status'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('test')
                        .setDescription('Send a test notification'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('reset')
                        .setDescription('Reset the livestream state'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('force')
                        .setDescription('Force a livestream check')))
        .addSubcommandGroup(group =>
            group
                .setName('features')
                .setDescription('Manage bot features')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all features and their status'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('toggle')
                        .setDescription('Toggle a feature on/off')
                        .addStringOption(option =>
                            option.setName('feature')
                                .setDescription('Feature to toggle')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Polls', value: 'polls' },
                                    { name: 'Match Submissions', value: 'matchSubmissions' },
                                    { name: 'Tickets', value: 'tickets' },
                                    { name: 'Coin Toss', value: 'coinToss' },
                                    { name: 'Livestream Notifications', value: 'livestreamNotifications' },
                                    { name: 'Admin Commands', value: 'adminCommands' }
                                )))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enable a feature')
                        .addStringOption(option =>
                            option.setName('feature')
                                .setDescription('Feature to enable')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Polls', value: 'polls' },
                                    { name: 'Match Submissions', value: 'matchSubmissions' },
                                    { name: 'Tickets', value: 'tickets' },
                                    { name: 'Coin Toss', value: 'coinToss' },
                                    { name: 'Livestream Notifications', value: 'livestreamNotifications' },
                                    { name: 'Admin Commands', value: 'adminCommands' }
                                )))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disable a feature')
                        .addStringOption(option =>
                            option.setName('feature')
                                .setDescription('Feature to disable')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Polls', value: 'polls' },
                                    { name: 'Match Submissions', value: 'matchSubmissions' },
                                    { name: 'Tickets', value: 'tickets' },
                                    { name: 'Coin Toss', value: 'coinToss' },
                                    { name: 'Livestream Notifications', value: 'livestreamNotifications' },
                                    { name: 'Admin Commands', value: 'adminCommands' }
                                )))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('reset')
                        .setDescription('Reset all features to enabled'))),
    
    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        
        // Handle livestream subcommands
        if (subcommandGroup === 'livestream') {
            const livestreamManager = interaction.client.livestreamManager;
            
            if (!livestreamManager) {
                return interaction.reply({
                    content: '❌ Livestream manager is not initialized.',
                    flags: 64
                });
            }
            
            switch (subcommand) {
                case 'status':
                    await this.livestreamStatus(interaction, livestreamManager);
                    break;
                case 'test':
                    await this.livestreamTest(interaction, livestreamManager);
                    break;
                case 'reset':
                    await this.livestreamReset(interaction, livestreamManager);
                    break;
                case 'force':
                    await this.livestreamForce(interaction, livestreamManager);
                    break;
            }
            return;
        }
        
        // Handle features subcommands
        if (subcommandGroup === 'features') {
            switch (subcommand) {
                case 'list':
                    await this.featuresList(interaction);
                    break;
                case 'toggle':
                    await this.featuresToggle(interaction);
                    break;
                case 'enable':
                    await this.featuresEnable(interaction);
                    break;
                case 'disable':
                    await this.featuresDisable(interaction);
                    break;
                case 'reset':
                    await this.featuresReset(interaction);
                    break;
            }
            return;
        }
        
        // Handle regular subcommands
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
                { name: '1. Create Channels', value: 'Create the following channels:\n• #complaints\n• #suggestions\n• #match-submissions\n• #youtube-notifications (for livestream alerts)', inline: false },
                { name: '2. Set Roles', value: 'Create and assign the following roles:\n• Admin\n• Moderator\n• Tournament Manager', inline: false },
                { name: '3. Configure .env', value: 'Add the channel and role IDs to your .env file:\n```\nCOMPLAINT_CHANNEL_ID=...\nSUGGESTION_CHANNEL_ID=...\nMATCH_SUBMISSION_CHANNEL_ID=...\nADMIN_ROLE_ID=...\nMOD_ROLE_ID=...\nTOURNAMENT_MANAGER_ROLE_ID=...\nYOUTUBE_API_KEY=...\nYOUTUBE_CHANNEL_ID=...\nYOUTUBE_NOTIFICATION_CHANNEL_ID=...\n```', inline: false },
                { name: '4. Create Ticket Panel', value: 'Use `/ticket panel` to create the ticket system panel in your desired channel', inline: false },
                { name: '5. Test Commands', value: 'Test the following commands:\n• `/cointoss`\n• `/match submit`\n• `/ticket create`\n• `/admin livestream test`\n• `/admin features list`', inline: false }
            )
            .setFooter({ text: 'After setup, restart the bot for changes to take effect' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    // Feature Management Methods
    async featuresList(interaction) {
        const features = featureManager.getAllFeatures();
        const grouped = featureManager.getFeaturesGrouped();
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('⚙️ Bot Feature Management')
            .setDescription('Here are all bot features and their current status:')
            .setTimestamp();
        
        // Add enabled features
        if (grouped.enabled.length > 0) {
            const enabledList = grouped.enabled.map(f => 
                `✅ **${f.name}** - ${f.description}`
            ).join('\n');
            embed.addFields({ name: '🟢 Enabled Features', value: enabledList, inline: false });
        }
        
        // Add disabled features
        if (grouped.disabled.length > 0) {
            const disabledList = grouped.disabled.map(f => 
                `❌ **${f.name}** - ${f.description}`
            ).join('\n');
            embed.addFields({ name: '🔴 Disabled Features', value: disabledList, inline: false });
        }
        
        embed.setFooter({ text: 'Use /admin features toggle <feature> to change status' });
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    async featuresToggle(interaction) {
        const feature = interaction.options.getString('feature');
        const newState = featureManager.toggle(feature);
        
        const embed = new EmbedBuilder()
            .setColor(newState ? 0x00FF00 : 0xFF0000)
            .setTitle(`${newState ? '✅' : '❌'} Feature Toggled`)
            .setDescription(`**${feature}** is now ${newState ? 'enabled' : 'disabled'}`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        logger.info(`Feature toggled via admin command: ${feature} -> ${newState}`);
    },
    
    async featuresEnable(interaction) {
        const feature = interaction.options.getString('feature');
        featureManager.enable(feature);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Feature Enabled')
            .setDescription(`**${feature}** is now enabled`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        logger.info(`Feature enabled via admin command: ${feature}`);
    },
    
    async featuresDisable(interaction) {
        const feature = interaction.options.getString('feature');
        featureManager.disable(feature);
        
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Feature Disabled')
            .setDescription(`**${feature}** is now disabled`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        logger.info(`Feature disabled via admin command: ${feature}`);
    },
    
    async featuresReset(interaction) {
        featureManager.resetAll();
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔄 All Features Reset')
            .setDescription('All features have been reset to enabled')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        logger.info('All features reset via admin command');
    },
    
    // Livestream Management Methods - UPDATED with Prime Time info
    async livestreamStatus(interaction, manager) {
        const stats = manager.getStats();
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📺 YouTube Livestream Status')
            .addFields(
                { name: 'Status', value: stats.isRunning ? '🟢 Active' : '🔴 Inactive', inline: true },
                { name: 'Mode', value: stats.mode || (stats.isPrimeTime ? '🔴 INSTANT DETECTION (10s)' : '💤 SLEEP MODE'), inline: true },
                { name: 'Check Interval', value: stats.checkInterval || (stats.isPrimeTime ? '10 seconds' : 'No checks (sleeping)'), inline: true },
                { name: 'Total Checks', value: stats.totalChecks.toString(), inline: true },
                { name: 'Prime Checks', value: (stats.primeChecks || 0).toString(), inline: true },
                { name: 'Notifications Sent', value: stats.notificationsSent.toString(), inline: true },
                { name: 'Last Check', value: stats.lastCheckTime || 'Never', inline: true },
                { name: 'Next Prime Time', value: stats.nextPrimeTime || 'Calculating...', inline: true },
                { name: 'Current Status', value: stats.currentStatus.isLive ? '🔴 Live' : '⚪ Not Live', inline: true },
                { name: 'Polls Active', value: stats.hasActivePoll ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Last Stream ID', value: stats.lastLiveStreamId || 'None', inline: true }
            )
            .setTimestamp();
        
        if (stats.currentStatus.currentStreamData) {
            embed.addFields({ 
                name: '📺 Current Stream', 
                value: `**${stats.currentStatus.currentStreamData.title}**\n🔗 ${stats.currentStatus.currentStreamData.url}`,
                inline: false 
            });
        }
        
        // Add prime time info
        const now = new Date();
        const hour = now.getHours();
        const isPrime = hour >= 20 || hour < 0;
        embed.addFields({ 
            name: '⏰ Prime Time Status', 
            value: isPrime ? '🟢 **ACTIVE** (8pm-12am) - 10 second checks' : '⚪ **INACTIVE** (12am-8pm) - No checks',
            inline: false 
        });
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    async livestreamTest(interaction, manager) {
        await interaction.deferReply({ flags: 64 });
        const success = await manager.sendTestNotification();
        await interaction.editReply({
            content: success ? '✅ Test notification sent successfully!' : '❌ Failed to send test notification.'
        });
    },
    
    async livestreamReset(interaction, manager) {
        await interaction.deferReply({ flags: 64 });
        manager.resetState();
        await interaction.editReply({
            content: '🔄 Livestream state has been reset. The next livestream will trigger a notification.'
        });
    },
    
    async livestreamForce(interaction, manager) {
        await interaction.deferReply({ flags: 64 });
        const status = await manager.forceCheck();
        await interaction.editReply({
            content: `✅ Forced check complete.\n**Live:** ${status.isLive ? 'Yes 🔴' : 'No ⚪'}\n**Last Stream ID:** ${status.lastLiveStreamId || 'None'}`
        });
    }
};