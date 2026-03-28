// This file can be used with external cron services
const axios = require('axios');

const URL = process.env.RENDER_EXTERNAL_URL || 'https://ml-hub-bot.onrender.com';

async function ping() {
    try {
        const response = await axios.get(`${URL}/ping`, { timeout: 10000 });
        console.log(`✅ Ping successful: ${response.status}`);
    } catch (error) {
        console.error(`❌ Ping failed: ${error.message}`);
    }
}

// Ping every 5 minutes
setInterval(ping, 5 * 60 * 1000);

console.log(`🔄 Uptime monitor started for ${URL}`);