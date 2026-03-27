require('dotenv').config();

module.exports = {
    // Discord Config
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    
    // Firebase Config
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    },
    
    // Channel & Role IDs
    ticketCategoryId: process.env.TICKET_CATEGORY_ID,
    ticketChannelId: process.env.TICKET_CHANNEL_ID, // New channel for support tickets
    matchSubmissionChannelId: process.env.MATCH_SUBMISSION_CHANNEL_ID,
    suggestionChannelId: process.env.SUGGESTION_CHANNEL_ID,
    complaintChannelId: process.env.COMPLAINT_CHANNEL_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID,
    modRoleId: process.env.MOD_ROLE_ID,
    tournamentManagerRoleId: process.env.TOURNAMENT_MANAGER_ROLE_ID,
    
    // Bot Settings
    prefix: '!',
    ticketLimit: 3,
    ticketCooldown: 300000,
};