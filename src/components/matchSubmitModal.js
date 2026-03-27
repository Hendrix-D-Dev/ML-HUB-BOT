const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: 'match_submit_modal',
    
    async execute(interaction) {
        const squad1Name = interaction.fields.getTextInputValue('squad1_name');
        const squad2Name = interaction.fields.getTextInputValue('squad2_name');
        const squad1Score = interaction.fields.getTextInputValue('squad1_score');
        const squad2Score = interaction.fields.getTextInputValue('squad2_score');
        const tournament = interaction.fields.getTextInputValue('tournament') || 'Regular Match';
        
        // Create match ID
        const matchId = `ML-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        // Determine winner
        const parseScore = (score) => {
            if (typeof score === 'number') return score;
            const parts = score.toString().split('-');
            return parseInt(parts[0]) || 0;
        };
        
        const s1 = parseScore(squad1Score);
        const s2 = parseScore(squad2Score);
        let winner = null;
        if (s1 > s2) winner = squad1Name;
        else if (s2 > s1) winner = squad2Name;
        else winner = 'Tie';
        
        // Create match in database
        const matchData = {
            matchId,
            squad1: { name: squad1Name, score: squad1Score },
            squad2: { name: squad2Name, score: squad2Score },
            winner,
            screenshots: [],
            submittedBy: {
                userId: interaction.user.id,
                username: interaction.user.username
            },
            tournament,
            status: 'pending',
            matchDate: new Date().toISOString()
        };
        
        await database.createMatch(matchData);
        
        // Create embed for submission channel
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Match Result Submission')
            .setDescription(`Match ID: **${matchId}**`)
            .addFields(
                { name: '🏆 Tournament', value: tournament, inline: true },
                { name: '👤 Submitted By', value: interaction.user.tag, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '🏆 Squad 1', value: `**${squad1Name}**\nScore: ${squad1Score}`, inline: true },
                { name: '🏆 Squad 2', value: `**${squad2Name}**\nScore: ${squad2Score}`, inline: true },
                { name: '👑 Winner', value: winner, inline: true }
            )
            .setFooter({ text: 'Use the buttons below to manage this match' })
            .setTimestamp();
        
        // Send to match submission channel
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (!submissionChannel) {
            logger.error('Match submission channel not found');
            return interaction.reply({
                content: '❌ Match submission channel not configured! Please contact an administrator.',
                flags: 64
            });
        }
        
        // Create buttons for match management
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_screenshot_${matchId}`)
                    .setLabel('📸 Add Screenshot')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📸'),
                new ButtonBuilder()
                    .setCustomId(`match_verify_${matchId}`)
                    .setLabel('✅ Verify')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`match_reject_${matchId}`)
                    .setLabel('❌ Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
        
        const message = await submissionChannel.send({ 
            content: `<@&${config.tournamentManagerRoleId}> <@&${config.adminRoleId}>`,
            embeds: [embed], 
            components: [row] 
        });
        
        // Store message ID for later updates
        await database.updateMatch(matchId, { messageId: message.id });
        
        await interaction.reply({
            content: `✅ Match result submitted successfully!\n**Match ID:** \`${matchId}\`\n📸 Click the "Add Screenshot" button below to upload your match screenshots.`,
            flags: 64
        });
        
        // Send a follow-up with the match details for the user to add screenshots
        const userRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_screenshot_user_${matchId}`)
                    .setLabel('📸 Add Screenshot')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📸')
            );
        
        await interaction.followUp({
            content: `**Match Details:**\n**${squad1Name}** (${squad1Score}) vs **${squad2Name}** (${squad2Score})\n\nClick the button below to upload your match screenshots:`,
            components: [userRow],
            flags: 64
        });
        
        logger.info(`Match submitted: ${matchId} by ${interaction.user.tag}`);
    }
};