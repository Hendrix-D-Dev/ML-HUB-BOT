const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cointoss')
        .setDescription('Toss a coin to decide first pick for tournaments')
        .addStringOption(option =>
            option.setName('squad1')
                .setDescription('Name of first squad')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('squad2')
                .setDescription('Name of second squad')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('captain1')
                .setDescription('Captain of first squad')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('captain2')
                .setDescription('Captain of second squad')
                .setRequired(true)),
    
    async execute(interaction) {
        const squad1 = interaction.options.getString('squad1');
        const squad2 = interaction.options.getString('squad2');
        const captain1 = interaction.options.getUser('captain1');
        const captain2 = interaction.options.getUser('captain2');
        
        // Create initial embed
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎲 Coin Toss')
            .setDescription(`**${squad1}** vs **${squad2}**\n\nClick the button below to toss the coin!`)
            .addFields(
                { name: 'Squad 1 Captain', value: `${captain1}`, inline: true },
                { name: 'Squad 2 Captain', value: `${captain2}`, inline: true }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`cointoss_${squad1}_${squad2}_${captain1.id}_${captain2.id}`)
                    .setLabel('Toss Coin')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🪙')
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
    }
};