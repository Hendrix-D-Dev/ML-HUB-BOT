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
    
    // Cloudinary Config
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    
    // YouTube Config - PRIME TIME OPTIMIZED
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY,
        channelId: process.env.YOUTUBE_CHANNEL_ID,
        notificationChannelId: process.env.YOUTUBE_NOTIFICATION_CHANNEL_ID,
        checkInterval: parseInt(process.env.YOUTUBE_CHECK_INTERVAL) || 3600000, // 1 hour default
        primeStart: parseInt(process.env.YOUTUBE_PRIME_START) || 20, // 8pm default
        primeEnd: parseInt(process.env.YOUTUBE_PRIME_END) || 23, // 11pm default
        primeInterval: parseInt(process.env.YOUTUBE_PRIME_INTERVAL) || 300000, // 5 minutes default
    },
    
    // Channel & Role IDs
    ticketCategoryId: process.env.TICKET_CATEGORY_ID,
    ticketChannelId: process.env.TICKET_CHANNEL_ID,
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