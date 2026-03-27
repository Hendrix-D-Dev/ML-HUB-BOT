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

// Add safeguard for concurrent commands
client.maxConcurrentCommands = 10;
client.activeCommands = 0;
client.commandQueue = [];

// Process command queue
client.processQueue = async () => {
    if (client.commandQueue.length > 0 && client.activeCommands < client.maxConcurrentCommands) {
        const { interaction, command } = client.commandQueue.shift();
        client.activeCommands++;
        
        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error(`Error executing queued command: ${error.message}`);
        } finally {
            client.activeCommands--;
            client.processQueue();
        }
    }
};

// Load commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

logger.info(`📂 Found ${commandFiles.length} command files`);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            logger.info(`✅ Loaded command: ${command.data.name}`);
        } else {
            logger.warn(`⚠️ Command ${filePath} is missing required properties`);
        }
    } catch (error) {
        logger.error(`❌ Failed to load command ${file}: ${error.message}`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

logger.info(`📂 Found ${eventFiles.length} event files`);

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        logger.info(`✅ Loaded event: ${event.name}`);
    } catch (error) {
        logger.error(`❌ Failed to load event ${file}: ${error.message}`);
    }
}

// Load components
const componentsPath = path.join(__dirname, 'components');
if (fs.existsSync(componentsPath)) {
    const componentFiles = fs.readdirSync(componentsPath).filter(file => file.endsWith('.js'));
    logger.info(`📂 Found ${componentFiles.length} component files`);
    
    for (const file of componentFiles) {
        const filePath = path.join(componentsPath, file);
        try {
            const component = require(filePath);
            const components = Array.isArray(component) ? component : [component];
            
            for (const comp of components) {
                if (comp.type === 'button' && comp.customId) {
                    client.buttonHandlers.set(comp.customId, comp.execute);
                    logger.info(`✅ Loaded button handler: ${comp.customId}`);
                }
                
                if (comp.type === 'modal' && comp.customId) {
                    client.modalHandlers.set(comp.customId, comp.execute);
                    logger.info(`✅ Loaded modal handler: ${comp.customId}`);
                }
            }
        } catch (error) {
            logger.error(`❌ Failed to load component ${file}: ${error.message}`);
        }
    }
}

// Function to register commands with retry logic
async function registerCommandsWithRetry(retries = 3) {
    const rest = new REST({ version: '10', timeout: 30000 }).setToken(config.token);
    
    for (let i = 0; i < retries; i++) {
        try {
            logger.info(`🔄 Registering slash commands (attempt ${i + 1}/${retries})...`);
            logger.info(`📝 Commands to register: ${commands.map(c => c.name).join(', ')}`);
            
            if (config.guildId) {
                logger.info(`📡 Using guild-specific commands for guild: ${config.guildId}`);
                await rest.put(
                    Routes.applicationGuildCommands(config.clientId, config.guildId),
                    { body: commands }
                );
                logger.info('✅ Guild commands registered successfully');
            } else {
                logger.info('🌍 Using global commands');
                await rest.put(
                    Routes.applicationCommands(config.clientId),
                    { body: commands }
                );
                logger.info('✅ Global commands registered successfully');
            }
            return true;
        } catch (error) {
            logger.error(`❌ Command registration attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                logger.info(`⏳ Waiting 5 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    return false;
}

// Start the bot
async function startBot() {
    try {
        logger.info('🚀 Starting ML HUB BOT...');
        logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        
        // Register commands
        const commandsRegistered = await registerCommandsWithRetry();
        
        if (!commandsRegistered) {
            logger.error('❌ Failed to register commands after multiple attempts');
            // Continue anyway - commands might have been registered previously
        }
        
        // Wait for command propagation
        logger.info('⏳ Waiting 3 seconds for command propagation...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Initialize Firebase
        logger.info('🔥 Initializing Firebase...');
        await database.initialize();
        logger.info('✅ Firebase database ready');
        
        // Login to Discord
        logger.info('🔑 Logging into Discord...');
        await client.login(config.token);
        logger.info('✅ Discord login successful');
        
    } catch (error) {
        logger.error(`❌ Failed to start: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM signal received: shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', error => {
    logger.error(`💥 Unhandled promise rejection: ${error.message}`);
    logger.error(error.stack);
});

process.on('uncaughtException', error => {
    logger.error(`💥 Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});

// Log when client is ready
client.once('ready', () => {
    logger.info(`🎉 ${client.user.tag} is online and ready!`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);
    logger.info(`👥 Total users: ${client.users.cache.size}`);
});