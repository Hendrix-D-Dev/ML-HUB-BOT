const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    type: 'button',
    customId: /^match_cancel_.+$/,
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const matchId = interaction.customId.replace('match_cancel_', '');
        
        const pendingMatch = interaction.client.pendingMatches?.[matchId];
        if (pendingMatch && pendingMatch.collector) {
            pendingMatch.collector.stop();
        }
        
        if (interaction.client.pendingMatches) {
            delete interaction.client.pendingMatches[matchId];
        }
        
        await interaction.editReply({
            content: '❌ Match submission cancelled. You can start over with `/match submit` when ready.'
        });
        
        logger.info(`Match submission cancelled: ${matchId} by ${interaction.user.tag}`);
    }
};