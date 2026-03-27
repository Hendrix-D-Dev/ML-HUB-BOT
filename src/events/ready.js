const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.info(`✅ ${client.user.tag} is online!`);
        logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);
        
        // Set bot status
        client.user.setPresence({
            activities: [{ 
                name: 'Mobile Legends | !help', 
                type: 3 // Watching
            }],
            status: 'online'
        });
    }
};