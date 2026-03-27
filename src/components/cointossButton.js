const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    type: 'button',
    customId: /^cointoss_.+$/,
    
    async execute(interaction) {
        const [_, squad1, squad2, captain1Id, captain2Id] = interaction.customId.split('_');
        
        // Check if user is one of the captains
        if (interaction.user.id !== captain1Id && interaction.user.id !== captain2Id) {
            return interaction.reply({
                content: '❌ Only the squad captains can toss the coin!',
                ephemeral: true
            });
        }
        
        // Random coin toss
        const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
        const winner = result === 'HEADS' ? squad1 : squad2;
        const winnerCaptain = result === 'HEADS' ? captain1Id : captain2Id;
        
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🪙 Coin Toss Result')
            .setDescription(`The coin landed on **${result}**!`)
            .addFields(
                { name: 'Winner', value: `**${winner}**`, inline: true },
                { name: 'First Pick', value: `<@${winnerCaptain}>`, inline: true }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`cointoss_confirm_${winner}`)
                    .setLabel('Confirm Result')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );
        
        await interaction.update({ embeds: [embed], components: [row] });
        
        // Log the result
        console.log(`Coin toss result: ${winner} wins the toss!`);
    }
};