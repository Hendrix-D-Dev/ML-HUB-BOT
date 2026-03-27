const winston = require('winston');
const chalk = require('chalk');

const colors = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    debug: chalk.green
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            const color = colors[level] || chalk.white;
            let output = `${chalk.gray(timestamp)} ${color(`[${level.toUpperCase()}]`)} ${message}`;
            if (stack) {
                output += `\n${chalk.red(stack)}`;
            }
            return output;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// Add method to log HTTP requests
logger.http = (message) => {
    logger.info(`🌐 ${message}`);
};

module.exports = logger;