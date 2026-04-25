const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const cloudinary = require('../utils/cloudinary');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: 'match_submit_modal',
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 }); // Ephemeral reply
        
        const squad1Name = interaction.fields.getTextInputValue('squad1_name');
        const squad2Name = interaction.fields.getTextInputValue('squad2_name');
        const squad1Score = interaction.fields.getTextInputValue('squad1_score');
        const squad2Score = interaction.fields.getTextInputValue('squad2_score');
        const tournament = interaction.fields.getTextInputValue('tournament') || 'Regular Match';
        
        // Create match ID
        const matchId = `ML-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        // Parse scores to determine winner
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
        
        // Store match data temporarily
        interaction.client.pendingMatches = interaction.client.pendingMatches || {};
        interaction.client.pendingMatches[matchId] = {
            squad1Name,
            squad2Name,
            squad1Score,
            squad2Score,
            tournament,
            winner,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            screenshots: [],
            status: 'pending'
        };
        
        // Create private screenshot upload panel (ephemeral)
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📸 Match Screenshots')
            .setDescription(`**Match:** ${squad1Name} vs ${squad2Name}\n**Match ID:** \`${matchId}\``)
            .addFields(
                { name: 'Step 1', value: 'Upload your match result screenshots below', inline: false },
                { name: 'Step 2', value: 'Click **Submit Match** when done', inline: false },
                { name: 'Uploaded Screenshots', value: 'None yet', inline: false }
            )
            .setFooter({ text: 'You have 5 minutes to upload screenshots' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_submit_final_${matchId}`)
                    .setLabel('✅ Submit Match')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
                    .setDisabled(true), // Disabled until screenshots are added
                new ButtonBuilder()
                    .setCustomId(`match_cancel_${matchId}`)
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        
        // Set up a private message collector for screenshots (only visible to user)
        const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
        const collector = interaction.channel.createMessageCollector({ filter, time: 300000 }); // 5 minutes
        
        collector.on('collect', async (message) => {
            // Process screenshots privately
            const tempUrls = [];
            message.attachments.forEach(attachment => {
                if (attachment.contentType?.startsWith('image/')) {
                    tempUrls.push(attachment.url);
                }
            });
            
            if (tempUrls.length > 0) {
                // Upload to Cloudinary
                const uploadedUrls = await cloudinary.uploadMultipleScreenshots(tempUrls, matchId);
                const pendingMatch = interaction.client.pendingMatches[matchId];
                pendingMatch.screenshots.push(...uploadedUrls);
                
                // Update the ephemeral message with new screenshot count
                const updatedEmbed = EmbedBuilder.from(embed);
                updatedEmbed.spliceFields(2, 1, {
                    name: 'Uploaded Screenshots',
                    value: `${pendingMatch.screenshots.length} screenshot(s) uploaded`,
                    inline: false
                });
                
                const updatedRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_submit_final_${matchId}`)
                            .setLabel('✅ Submit Match')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(false), // Now enabled
                        new ButtonBuilder()
                            .setCustomId(`match_cancel_${matchId}`)
                            .setLabel('❌ Cancel')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    );
                
                await interaction.editReply({
                    embeds: [updatedEmbed],
                    components: [updatedRow]
                });
                
                // Send private confirmation (will be auto-deleted)
                await message.reply({
                    content: `✅ ${uploadedUrls.length} screenshot(s) added. Total: ${pendingMatch.screenshots.length}`,
                    flags: 64
                });
            }
            
            // Delete the user's message to keep chat clean
            await message.delete();
        });
        
        // Store collector for cleanup
        interaction.client.pendingMatches[matchId].collector = collector;
        
        logger.info(`Match submission started: ${matchId} by ${interaction.user.tag}`);
    }
};