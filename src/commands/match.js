const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const cloudinary = require('../utils/cloudinary');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('match')
        .setDescription('Submit or manage match results')
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit a new match result with screenshots'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verify a match submission')
                .addStringOption(option =>
                    option.setName('matchid')
                        .setDescription('Match ID to verify')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reject')
                .setDescription('Reject a match submission')
                .addStringOption(option =>
                    option.setName('matchid')
                        .setDescription('Match ID to reject')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for rejection')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View match details')
                .addStringOption(option =>
                    option.setName('matchid')
                        .setDescription('Match ID to view')
                        .setRequired(true))),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'submit':
                await this.showSubmitModal(interaction);
                break;
            case 'verify':
                await this.verifyMatch(interaction);
                break;
            case 'reject':
                await this.rejectMatch(interaction);
                break;
            case 'view':
                await this.viewMatch(interaction);
                break;
        }
    },
    
    async showSubmitModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('match_submit_modal')
            .setTitle('Submit Match Results');
        
        const squad1NameInput = new TextInputBuilder()
            .setCustomId('squad1_name')
            .setLabel('Squad 1 Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter squad name')
            .setRequired(true);
        
        const squad2NameInput = new TextInputBuilder()
            .setCustomId('squad2_name')
            .setLabel('Squad 2 Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter squad name')
            .setRequired(true);
        
        const squad1ScoreInput = new TextInputBuilder()
            .setCustomId('squad1_score')
            .setLabel('Squad 1 Score')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 2-0 or 3')
            .setRequired(true);
        
        const squad2ScoreInput = new TextInputBuilder()
            .setCustomId('squad2_score')
            .setLabel('Squad 2 Score')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 0-2 or 1')
            .setRequired(true);
        
        const tournamentInput = new TextInputBuilder()
            .setCustomId('tournament')
            .setLabel('Tournament Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Optional')
            .setRequired(false);
        
        const row1 = new ActionRowBuilder().addComponents(squad1NameInput);
        const row2 = new ActionRowBuilder().addComponents(squad2NameInput);
        const row3 = new ActionRowBuilder().addComponents(squad1ScoreInput);
        const row4 = new ActionRowBuilder().addComponents(squad2ScoreInput);
        const row5 = new ActionRowBuilder().addComponents(tournamentInput);
        
        modal.addComponents(row1, row2, row3, row4, row5);
        
        await interaction.showModal(modal);
    },
    
    async verifyMatch(interaction) {
        const matchId = interaction.options.getString('matchid');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found.',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified.',
                flags: 64
            });
        }
        
        await database.updateMatch(matchId, {
            status: 'verified',
            verifiedBy: {
                userId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date().toISOString()
            }
        });
        
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                originalEmbed.setColor(0x00FF00);
                originalEmbed.addFields({ 
                    name: 'Verified By', 
                    value: interaction.user.tag, 
                    inline: true 
                });
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_verified_${matchId}`)
                            .setLabel('Verified')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true)
                    );
                
                await originalMessage.edit({ embeds: [originalEmbed], components: [row] });
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
            }
        }
        
        await interaction.reply({
            content: `✅ Match **${matchId}** verified.`,
            flags: 64
        });
        
        logger.info(`Match verified: ${matchId} by ${interaction.user.tag}`);
    },
    
    async rejectMatch(interaction) {
        const matchId = interaction.options.getString('matchid');
        const reason = interaction.options.getString('reason');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found.',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified.',
                flags: 64
            });
        }
        
        await database.updateMatch(matchId, {
            status: 'rejected',
            rejectionReason: reason
        });
        
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel && match.messageId) {
            try {
                const originalMessage = await submissionChannel.messages.fetch(match.messageId);
                const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                originalEmbed.setColor(0xFF0000);
                originalEmbed.addFields(
                    { name: 'Rejected By', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                );
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_rejected_${matchId}`)
                            .setLabel('Rejected')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                            .setDisabled(true)
                    );
                
                await originalMessage.edit({ embeds: [originalEmbed], components: [row] });
            } catch (error) {
                logger.error(`Error updating match message: ${error.message}`);
            }
        }
        
        await interaction.reply({
            content: `✅ Match **${matchId}** rejected.`,
            flags: 64
        });
        
        logger.info(`Match rejected: ${matchId} by ${interaction.user.tag}`);
    },
    
    async viewMatch(interaction) {
        const matchId = interaction.options.getString('matchid');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found.',
                flags: 64
            });
        }
        
        const parseScore = (score) => {
            if (typeof score === 'number') return score;
            const parts = score.toString().split('-');
            return parseInt(parts[0]) || 0;
        };
        
        const s1 = parseScore(match.squad1.score);
        const s2 = parseScore(match.squad2.score);
        let winner = null;
        if (s1 > s2) winner = match.squad1.name;
        else if (s2 > s1) winner = match.squad2.name;
        else winner = 'Tie';
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Match: ${match.squad1.name} vs ${match.squad2.name}`)
            .addFields(
                { name: 'Match ID', value: matchId, inline: true },
                { name: 'Date', value: new Date(match.matchDate).toLocaleString(), inline: true },
                { name: 'Tournament', value: match.tournament || 'Regular Match', inline: true },
                { name: 'Status', value: match.status.toUpperCase(), inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: 'Score', value: `${match.squad1.score} - ${match.squad2.score}`, inline: true },
                { name: 'Winner', value: winner, inline: true },
                { name: 'Submitted By', value: match.submittedBy.username, inline: true }
            )
            .setTimestamp();
        
        if (match.screenshots && match.screenshots.length > 0) {
            const screenshotLinks = match.screenshots.map((url, i) => `[Screenshot ${i + 1}](${url})`).join('\n');
            embed.addFields({ name: '📸 Screenshots', value: screenshotLinks, inline: false });
        }
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};