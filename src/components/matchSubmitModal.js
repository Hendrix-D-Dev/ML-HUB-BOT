const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: 'match_submit_modal',
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const squad1Name = interaction.fields.getTextInputValue('squad1_name');
        const squad2Name = interaction.fields.getTextInputValue('squad2_name');
        const squad1Score = interaction.fields.getTextInputValue('squad1_score');
        const squad2Score = interaction.fields.getTextInputValue('squad2_score');
        const tournament = interaction.fields.getTextInputValue('tournament') || 'Regular Match';
        
        const matchId = `ML-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
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
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Match Result Submission')
            .setDescription(`Match ID: **${matchId}**`)
            .addFields(
                { name: 'Tournament', value: tournament, inline: true },
                { name: 'Submitted By', value: interaction.user.tag, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Squad 1', value: `**${squad1Name}**\nScore: ${squad1Score}`, inline: true },
                { name: 'Squad 2', value: `**${squad2Name}**\nScore: ${squad2Score}`, inline: true },
                { name: 'Winner', value: winner, inline: true }
            )
            .setTimestamp();
        
        const submissionChannel = interaction.guild.channels.cache.get(config.matchSubmissionChannelId);
        if (!submissionChannel) {
            logger.error('Match submission channel not found');
            return interaction.editReply({
                content: '❌ Match submission channel not configured.'
            });
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
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
        
        await database.updateMatch(matchId, { messageId: message.id });
        
        // Create private thread for screenshots
        const thread = await message.startThread({
            name: `📸 Screenshots for ${matchId}`,
            autoArchiveDuration: 60,
            reason: 'Screenshot submission thread'
        });
        
        await database.updateMatch(matchId, { threadId: thread.id });
        await thread.members.add(interaction.user.id);
        
        const threadEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📸 Upload Screenshots')
            .setDescription(`Please upload your match result screenshots here.\n\n**Match ID:** ${matchId}`)
            .setTimestamp();
        
        await thread.send({ 
            content: `${interaction.user}`,
            embeds: [threadEmbed]
        });
        
        // Send reply with thread link
        await interaction.editReply({
            content: `✅ Match result submitted successfully!\n**Match ID:** \`${matchId}\`\n**Match:** ${squad1Name} vs ${squad2Name}\n**Score:** ${squad1Score} - ${squad2Score}\n\n📸 [Click here to upload your screenshots](${thread.url})`
        });
        
        logger.info(`Match submitted: ${matchId} by ${interaction.user.tag}`);
    }
};