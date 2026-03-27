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
            .setFooter({ text: 'Screenshots are being collected privately from the submitter' })
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
        
        // Create buttons for staff
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
        
        // Store message ID for later updates
        await database.updateMatch(matchId, { messageId: message.id });
        
        // Create a private thread for screenshot uploads
        const thread = await message.startThread({
            name: `📸 Screenshots for ${matchId}`,
            autoArchiveDuration: 60,
            reason: 'Private screenshot submission thread'
        });
        
        // Add the submitter to the thread
        await thread.members.add(interaction.user.id);
        
        // Send initial instructions in the private thread
        const threadEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📸 Upload Match Screenshots')
            .setDescription(`**Match ID:** ${matchId}\n**Squads:** ${squad1Name} vs ${squad2Name}\n\nPlease upload your match result screenshots here. These screenshots will only be visible to you and staff members.`)
            .addFields(
                { name: 'Instructions', value: '1. Drag and drop or select your screenshots\n2. You can upload multiple screenshots\n3. Staff will verify the match after all screenshots are uploaded', inline: false }
            )
            .setTimestamp();
        
        await thread.send({ 
            content: `${interaction.user}`,
            embeds: [threadEmbed]
        });
        
        // Send initial reply to user
        await interaction.reply({
            content: `✅ Match result submitted successfully!\n\n**Match ID:** \`${matchId}\`\n**Match:** ${squad1Name} vs ${squad2Name}\n**Score:** ${squad1Score} - ${squad2Score}\n\n📸 A private thread has been created for you to upload your match screenshots. Please upload them there.\n🔗 [Click here to view your private thread](${thread.url})`,
            flags: 64
        });
        
        logger.info(`Match submitted: ${matchId} by ${interaction.user.tag}`);
    }
};