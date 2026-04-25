const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('../utils/database');
const cloudinary = require('../utils/cloudinary');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    type: 'modal',
    customId: 'match_submit_modal',
    
    async execute(interaction) {
        // Defer reply to give time for processing
        await interaction.deferReply({ flags: 64 });
        
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
        
        // Send a follow-up asking for screenshots
        const screenshotEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📸 Upload Match Screenshots')
            .setDescription(`Please upload your match result screenshots for **${squad1Name} vs ${squad2Name}**\n\n**Match ID:** \`${matchId}\``)
            .addFields(
                { name: 'Instructions', value: 'Upload your screenshots in the next 2 minutes. You can upload multiple images.\nAfter uploading, click **Done** to submit.', inline: false }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_done_${matchId}`)
                    .setLabel('✅ Done - Submit Match')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
        
        await interaction.followUp({
            embeds: [screenshotEmbed],
            components: [row],
            flags: 64
        });
        
        // Create collector for screenshot uploads
        const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
        const collector = interaction.channel.createMessageCollector({ filter, time: 120000 }); // 2 minutes
        
        const uploadedUrls = [];
        
        collector.on('collect', async (message) => {
            const tempUrls = [];
            message.attachments.forEach(attachment => {
                if (attachment.contentType?.startsWith('image/')) {
                    tempUrls.push(attachment.url);
                }
            });
            
            if (tempUrls.length > 0) {
                // Upload to Cloudinary
                const urls = await cloudinary.uploadMultipleScreenshots(tempUrls, matchId);
                uploadedUrls.push(...urls);
                
                await message.reply({
                    content: `✅ ${urls.length} screenshot(s) uploaded. Total: ${uploadedUrls.length} screenshot(s).`,
                    flags: 64
                });
                
                // Update the match with uploaded screenshots
                await database.updateMatch(matchId, { screenshots: uploadedUrls });
            }
            
            await message.delete(); // Clean up
        });
        
        // Store collector and match info for the Done button
        interaction.client.tempMatches = interaction.client.tempMatches || {};
        interaction.client.tempMatches[matchId] = {
            collector,
            squad1Name,
            squad2Name,
            squad1Score,
            squad2Score,
            tournament,
            winner,
            uploadedUrls
        };
        
        logger.info(`Match submission started: ${matchId} by ${interaction.user.tag}`);
    }
};