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
                        .setDescription('Ticket ID to close (use /ticket list to see your tickets)')
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
        
        // Defer only for close command to prevent timeout
        if (subcommand === 'close') {
            await interaction.deferReply({ flags: 64 });
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
            // Create an embed showing the user their open tickets
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Ticket Limit Reached')
                .setDescription(`You already have ${openTickets.length} open tickets. Please close some before creating a new one.`)
                .addFields(
                    { name: '📋 Your Open Tickets', value: openTickets.map(t => `**${t.ticketId}** - ${t.type.toUpperCase()}: ${t.title}`).join('\n') || 'No open tickets', inline: false },
                    { name: 'How to Close a Ticket', value: 'Use `/ticket close ticket_id:` followed by the ticket ID you want to close.\nExample: `/ticket close ticket_id: complaint-1234567890-1234`', inline: false }
                )
                .setTimestamp();
            
            // Check if interaction is already deferred
            if (interaction.deferred) {
                return interaction.editReply({ embeds: [embed] });
            }
            return interaction.reply({ embeds: [embed], flags: 64 });
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
                targetChannelId = config.ticketChannelId || config.ticketCategoryId;
                channelName = 'Tickets';
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
            const emoji = type === 'complaint' ? '⚠️' : (type === 'suggestion' ? '💡' : '🎫');
            
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
            
            const replyContent = `✅ Your ${type} has been submitted to #${channelName.toLowerCase()}.\n**Ticket ID:** \`${ticketId}\`\n\nUse \`/ticket list\` to see your open tickets or \`/ticket close ticket_id:${ticketId}\` to close this ticket.`;
            
            // Check if interaction is already deferred
            if (interaction.deferred) {
                return interaction.editReply({ content: replyContent });
            }
            return interaction.reply({ content: replyContent, flags: 64 });
        } else {
            const errorMsg = '❌ Could not find the target channel. Please contact an administrator.';
            if (interaction.deferred) {
                return interaction.editReply({ content: errorMsg });
            }
            return interaction.reply({ content: errorMsg, flags: 64 });
        }
    },
    
    async listTickets(interaction) {
        const userId = interaction.user.id;
        const tickets = await database.getUserOpenTickets(userId);
        
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📭 No Open Tickets')
                .setDescription('You have no open tickets.')
                .addFields(
                    { name: 'Create a Ticket', value: 'Use `/ticket create` to create a new ticket.', inline: false }
                )
                .setTimestamp();
            
            // Check if interaction is already deferred
            if (interaction.deferred) {
                return interaction.editReply({ embeds: [embed] });
            }
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Your Open Tickets')
            .setDescription(`You have ${tickets.length} open ticket(s) out of ${config.ticketLimit} maximum.`)
            .setTimestamp();
        
        tickets.forEach(ticket => {
            embed.addFields({
                name: `🔖 ${ticket.type.toUpperCase()}: ${ticket.title}`,
                value: `**ID:** \`${ticket.ticketId}\`\n**Created:** ${new Date(ticket.createdAt).toLocaleString()}\n**Status:** ${ticket.status}\n**To close:** \`/ticket close ticket_id:${ticket.ticketId}\``,
                inline: false
            });
        });
        
        embed.setFooter({ text: 'Use /ticket close with the ticket ID to close a ticket' });
        
        // Check if interaction is already deferred
        if (interaction.deferred) {
            return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    async closeTicket(interaction) {
        const ticketId = interaction.options.getString('ticket_id');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const userId = interaction.user.id;
        
        const ticket = await database.getTicket(ticketId);
        
        if (!ticket) {
            // Suggest checking ticket list
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Ticket Not Found')
                .setDescription(`Ticket ID **${ticketId}** was not found.`)
                .addFields(
                    { name: 'How to Find Your Tickets', value: 'Use `/ticket list` to see all your open tickets and their IDs.', inline: false }
                )
                .setTimestamp();
            
            // Use editReply since we deferred in execute
            return interaction.editReply({ embeds: [embed] });
        }
        
        // Check if user owns the ticket or is admin/mod
        const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
        const isMod = interaction.member.roles.cache.has(config.modRoleId);
        
        if (ticket.userId !== userId && !isAdmin && !isMod) {
            return interaction.editReply({
                content: '❌ You can only close your own tickets! Use `/ticket list` to see your tickets.'
            });
        }
        
        if (ticket.status === 'closed') {
            return interaction.editReply({
                content: '❌ This ticket is already closed!'
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
                targetChannelId = config.ticketChannelId || config.ticketCategoryId;
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
                try {
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
                } catch (error) {
                    logger.error(`Error updating ticket message: ${error.message}`);
                }
                
                await targetChannel.send({ embeds: [embed] });
            }
        }
        
        // Use editReply since we deferred in execute
        await interaction.editReply({
            content: `✅ Ticket **${ticketId}** has been closed.\n\nYou can now create new tickets if needed.`
        });
        
        logger.info(`Ticket closed: ${ticketId} by ${interaction.user.tag}`);
    },
    
    async createPanel(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎫 Ticket System')
            .setDescription('Need help? Click a button below to create a ticket:')
            .addFields(
                { name: '📝 Complaint', value: 'Report inappropriate behavior, rule violations, or disputes\n*Posts to #complaints channel*', inline: true },
                { name: '💡 Suggestion', value: 'Share your ideas to improve our community\n*Posts to #suggestions channel*', inline: true },
                { name: '🆘 Support', value: 'Get help with tournaments, matches, or general questions\n*Posts to #tickets channel*', inline: true }
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