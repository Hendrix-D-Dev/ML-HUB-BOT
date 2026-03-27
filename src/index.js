const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const database = require('./utils/database');
const logger = require('./utils/logger');

// Import the ping server
require('./server');

// Create client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration
    ]
});

// Initialize collections
client.commands = new Collection();
client.buttonHandlers = new Collection();
client.modalHandlers = new Collection();

// Load commands FIRST
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        logger.info(`Loaded command: ${command.data.name}`);
    } else {
        logger.warn(`Command ${filePath} is missing required properties`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
    logger.info(`Loaded event: ${event.name}`);
}

// Load components (buttons, modals)
const componentsPath = path.join(__dirname, 'components');
if (fs.existsSync(componentsPath)) {
    const componentFiles = fs.readdirSync(componentsPath).filter(file => file.endsWith('.js'));
    
    for (const file of componentFiles) {
        const filePath = path.join(componentsPath, file);
        const component = require(filePath);
        
        const components = Array.isArray(component) ? component : [component];
        
        for (const comp of components) {
            if (comp.type === 'button' && comp.customId) {
                client.buttonHandlers.set(comp.customId, comp.execute);
                logger.info(`Loaded button handler: ${comp.customId}`);
            }
            
            if (comp.type === 'modal' && comp.customId) {
                client.modalHandlers.set(comp.customId, comp.execute);
                logger.info(`Loaded modal handler: ${comp.customId}`);
            }
        }
    }
}

// Register slash commands and start bot
async function startBot() {
    try {
        // Initialize Firebase
        await database.initialize();
        logger.info('🔥 Firebase database ready');
        
        // Register slash commands BEFORE login
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        logger.info('🔄 Registering slash commands...');
        
        if (config.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            logger.info('✅ Guild commands registered successfully');
        } else {
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
            logger.info('✅ Global commands registered successfully');
        }
        
        // Wait a moment for commands to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now login to Discord
        await client.login(config.token);
        logger.info('🤖 Discord bot logged in');
        
    } catch (error) {
        logger.error(`Failed to start: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received: shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', error => {
    logger.error(`Unhandled promise rejection: ${error.message}`);
    logger.error(error.stack);
});

process.on('uncaughtException', error => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});