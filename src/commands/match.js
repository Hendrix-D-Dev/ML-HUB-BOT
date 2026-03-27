const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('match')
        .setDescription('Submit or manage match results')
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit match results with screenshots'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verify a match submission (Admin/Mod only)')
                .addStringOption(option =>
                    option.setName('matchid')
                        .setDescription('Match ID to verify')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reject')
                .setDescription('Reject a match submission (Admin/Mod only)')
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
            .setPlaceholder('Enter the name of the first squad')
            .setRequired(true);
        
        const squad2NameInput = new TextInputBuilder()
            .setCustomId('squad2_name')
            .setLabel('Squad 2 Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the name of the second squad')
            .setRequired(true);
        
        const squad1ScoreInput = new TextInputBuilder()
            .setCustomId('squad1_score')
            .setLabel('Squad 1 Score')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the score for Squad 1 (e.g., 2-0, 3-1)')
            .setRequired(true);
        
        const squad2ScoreInput = new TextInputBuilder()
            .setCustomId('squad2_score')
            .setLabel('Squad 2 Score')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the score for Squad 2 (e.g., 0-2, 1-3)')
            .setRequired(true);
        
        const tournamentInput = new TextInputBuilder()
            .setCustomId('tournament')
            .setLabel('Tournament Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter tournament name (optional)')
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
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified!',
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
        
        // Send notification to submission channel
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Match Verified')
                .setDescription(`Match **${matchId}** has been verified by ${interaction.user.tag}`)
                .addFields(
                    { name: '🏆 Squad 1', value: `${match.squad1.name} (${match.squad1.score})`, inline: true },
                    { name: '🏆 Squad 2', value: `${match.squad2.name} (${match.squad2.score})`, inline: true },
                    { name: '👑 Winner', value: this.determineWinner(match.squad1.score, match.squad2.score, match.squad1.name, match.squad2.name), inline: true }
                )
                .setTimestamp();
            
            await submissionChannel.send({ embeds: [embed] });
        }
        
        await interaction.reply({
            content: `✅ Match **${matchId}** verified successfully!`,
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
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        if (match.status === 'verified') {
            return interaction.reply({
                content: '❌ This match is already verified!',
                flags: 64
            });
        }
        
        await database.updateMatch(matchId, {
            status: 'rejected',
            rejectionReason: reason
        });
        
        // Send notification to submission channel
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (submissionChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Match Rejected')
                .setDescription(`Match **${matchId}** has been rejected by ${interaction.user.tag}`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true }
                )
                .setTimestamp();
            
            await submissionChannel.send({ embeds: [embed] });
        }
        
        await interaction.reply({
            content: `✅ Match **${matchId}** rejected!`,
            flags: 64
        });
        
        logger.info(`Match rejected: ${matchId} by ${interaction.user.tag}`);
    },
    
    async viewMatch(interaction) {
        const matchId = interaction.options.getString('matchid');
        
        const match = await database.getMatch(matchId);
        if (!match) {
            return interaction.reply({
                content: '❌ Match not found!',
                flags: 64
            });
        }
        
        const winner = this.determineWinner(match.squad1.score, match.squad2.score, match.squad1.name, match.squad2.name);
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🎮 Match Details: ${matchId}`)
            .addFields(
                { name: '📅 Date', value: new Date(match.matchDate).toLocaleString(), inline: true },
                { name: '🏆 Tournament', value: match.tournament || 'Regular Match', inline: true },
                { name: '📊 Status', value: match.status.toUpperCase(), inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '🏆 Squad 1', value: `**${match.squad1.name}**\nScore: ${match.squad1.score}`, inline: true },
                { name: '🏆 Squad 2', value: `**${match.squad2.name}**\nScore: ${match.squad2.score}`, inline: true },
                { name: '👑 Winner', value: winner, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '👤 Submitted By', value: match.submittedBy.username, inline: true }
            )
            .setTimestamp();
        
        if (match.screenshots && match.screenshots.length > 0) {
            embed.addFields({ name: '📸 Screenshots', value: match.screenshots.join('\n'), inline: false });
        }
        
        if (match.status === 'verified' && match.verifiedBy) {
            embed.addFields({ name: '✅ Verified By', value: match.verifiedBy.username, inline: true });
        }
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
    
    determineWinner(score1, score2, name1, name2) {
        // Parse scores if they're in format like "2-0"
        const parseScore = (score) => {
            if (typeof score === 'number') return score;
            const parts = score.toString().split('-');
            return parseInt(parts[0]) || 0;
        };
        
        const s1 = parseScore(score1);
        const s2 = parseScore(score2);
        
        if (s1 > s2) return name1;
        if (s2 > s1) return name2;
        return 'Tie';
    }
};