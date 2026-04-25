const axios = require('axios');

const URL = process.env.RENDER_EXTERNAL_URL || 'https://ml-hub-bot.onrender.com';
const INTERVAL = 3 * 60 * 1000; // 3 minutes

async function ping() {
    try {
        const response = await axios.get(`${URL}/ping`, { timeout: 10000 });
        console.log(`✅ ${new Date().toISOString()} - Ping successful: ${response.status}`);
    } catch (error) {
        console.error(`❌ ${new Date().toISOString()} - Ping failed: ${error.message}`);
    }
}

console.log(`🔄 Uptime monitor started for ${URL}`);
console.log(`⏰ Pinging every ${INTERVAL / 60000} minutes`);

// Ping immediately
ping();

// Set interval
setInterval(ping, INTERVAL);