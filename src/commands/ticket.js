const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create or manage tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new ticket (complaint, suggestion, or support)')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of ticket')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Complaint', value: 'complaint' },
                            { name: 'Suggestion', value: 'suggestion' },
                            { name: 'Support', value: 'support' }
                        ))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title of your ticket')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Describe your issue/suggestion')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your open tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close one of your tickets')
                .addStringOption(option =>
                    option.setName('ticket_id')
                        .setDescription('Ticket ID to close')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for closing')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create ticket panel (Admin only)')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        // Check permissions for admin-only subcommands
        if (subcommand === 'panel') {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ You need Administrator permissions to use this command!',
                    flags: 64
                });
            }
        }
        
        switch (subcommand) {
            case 'create':
                await this.createTicket(interaction);
                break;
            case 'list':
                await this.listTickets(interaction);
                break;
            case 'close':
                await this.closeTicket(interaction);
                break;
            case 'panel':
                await this.createPanel(interaction);
                break;
        }
    },
    
    async createTicket(interaction) {
        const type = interaction.options.getString('type');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const userId = interaction.user.id;
        
        // Check ticket limit
        const openTickets = await database.getUserOpenTickets(userId);
        if (openTickets.length >= config.ticketLimit) {
            return interaction.reply({
                content: `❌ You already have ${openTickets.length} open tickets. Please close some before creating a new one.`,
                flags: 64
            });
        }
        
        // Create ticket ID
        const ticketId = `${type}-${Date.now()}-${userId.slice(-4)}`;
        
        // Determine which channel to send to
        let targetChannelId = null;
        let channelName = '';
        
        switch (type) {
            case 'complaint':
                targetChannelId = config.complaintChannelId;
                channelName = 'Complaints';
                break;
            case 'suggestion':
                targetChannelId = config.suggestionChannelId;
                channelName = 'Suggestions';
                break;
            case 'support':
                targetChannelId = config.matchSubmissionChannelId;
                channelName = 'Support';
                break;
        }
        
        // Create ticket in database
        const ticketData = {
            ticketId,
            userId,
            userTag: interaction.user.tag,
            type,
            title,
            description,
            status: 'open',
            createdAt: new Date().toISOString(),
            messages: [{
                userId: interaction.user.id,
                username: interaction.user.username,
                content: description,
                timestamp: new Date().toISOString(),
                attachments: []
            }]
        };
        
        await database.createTicket(ticketData);
        
        // Send to appropriate channel
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (targetChannel) {
            const embedColor = type === 'complaint' ? 0xFF0000 : (type === 'suggestion' ? 0x00FF00 : 0x0099FF);
            const emoji = type === 'complaint' ? '⚠️' : (type === 'suggestion' ? '💡' : '🆘');
            
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${emoji} ${type.toUpperCase()}: ${title}`)
                .setDescription(description)
                .addFields(
                    { name: 'Ticket ID', value: ticketId, inline: true },
                    { name: 'From', value: interaction.user.tag, inline: true },
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Status', value: 'Open', inline: true }
                )
                .setTimestamp();
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_close_${ticketId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId(`ticket_reply_${ticketId}`)
                        .setLabel('Reply')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💬')
                );
            
            await targetChannel.send({ 
                content: `<@&${config.adminRoleId}> <@&${config.modRoleId}>`,
                embeds: [embed], 
                components: [row] 
            });
            
            await interaction.reply({
                content: `✅ Your ${type} has been submitted to #${channelName.toLowerCase()}. Staff will review it shortly.\n**Ticket ID:** \`${ticketId}\``,
                flags: 64
            });
        } else {
            await interaction.reply({
                content: '❌ Could not find the target channel. Please contact an administrator.',
                flags: 64
            });
        }
        
        logger.info(`Ticket created: ${ticketId} by ${interaction.user.tag}`);
    },
    
    async listTickets(interaction) {
        const userId = interaction.user.id;
        const tickets = await database.getUserOpenTickets(userId);
        
        if (tickets.length === 0) {
            return interaction.reply({
                content: '📭 You have no open tickets.',
                flags: 64
            });
        }
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Your Open Tickets')
            .setDescription(`You have ${tickets.length} open ticket(s)`)
            .setTimestamp();
        
        tickets.forEach(ticket => {
            embed.addFields({
                name: `${ticket.type.toUpperCase()}: ${ticket.title}`,
                value: `**ID:** \`${ticket.ticketId}\`\n**Created:** ${new Date(ticket.createdAt).toLocaleString()}\n**Status:** ${ticket.status}`,
                inline: false
            });
        });
        
        embed.setFooter({ text: 'Use /ticket close <ticket_id> to close a ticket' });
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    async closeTicket(interaction) {
        const ticketId = interaction.options.getString('ticket_id');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const userId = interaction.user.id;
        
        const ticket = await database.getTicket(ticketId);
        
        if (!ticket) {
            return interaction.reply({
                content: '❌ Ticket not found. Please check the ticket ID.',
                flags: 64
            });
        }
        
        // Check if user owns the ticket or is admin/mod
        const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        
        if (ticket.userId !== userId && !isAdmin && !isMod) {
            return interaction.reply({
                content: '❌ You can only close your own tickets!',
                flags: 64
            });
        }
        
        if (ticket.status === 'closed') {
            return interaction.reply({
                content: '❌ This ticket is already closed!',
                flags: 64
            });
        }
        
        await database.updateTicket(ticketId, {
            status: 'closed',
            closedAt: new Date().toISOString(),
            closedBy: interaction.user.id,
            closeReason: reason
        });
        
        // Notify in the original channel if possible
        let targetChannelId = null;
        switch (ticket.type) {
            case 'complaint':
                targetChannelId = config.complaintChannelId;
                break;
            case 'suggestion':
                targetChannelId = config.suggestionChannelId;
                break;
            case 'support':
                targetChannelId = config.matchSubmissionChannelId;
                break;
        }
        
        if (targetChannelId) {
            const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (targetChannel) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`Ticket **${ticketId}** has been closed`)
                    .addFields(
                        { name: 'Closed By', value: interaction.user.tag, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setTimestamp();
                
                // Try to find and update the original message
                const messages = await targetChannel.messages.fetch({ limit: 50 });
                const ticketMessage = messages.find(m => 
                    m.embeds[0]?.fields?.some(f => f.value === ticketId)
                );
                
                if (ticketMessage) {
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ticket_closed_${ticketId}`)
                                .setLabel('Closed')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    await ticketMessage.edit({ components: [row] });
                }
                
                await targetChannel.send({ embeds: [embed] });
            }
        }
        
        await interaction.reply({
            content: `✅ Ticket **${ticketId}** has been closed.`,
            flags: 64
        });
        
        logger.info(`Ticket closed: ${ticketId} by ${interaction.user.tag}`);
    },
    
    async createPanel(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎫 Ticket System')
            .setDescription('Need help? Click a button below to create a ticket:')
            .addFields(
                { name: '📝 Complaint', value: 'Report inappropriate behavior, rule violations, or disputes', inline: true },
                { name: '💡 Suggestion', value: 'Share your ideas to improve our community', inline: true },
                { name: '🆘 Support', value: 'Get help with tournaments, matches, or general questions', inline: true }
            )
            .setFooter({ text: 'Your ticket will be sent to the appropriate channel' });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_complaint')
                    .setLabel('📝 Complaint')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_suggestion')
                    .setLabel('💡 Suggestion')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_support')
                    .setLabel('🆘 Support')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
    }
};