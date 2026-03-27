const winston = require('winston');
const chalk = require('chalk');

const colors = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    debug: chalk.green
};

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            const color = colors[level] || chalk.white;
            return `${chalk.gray(timestamp)} ${color(`[${level.toUpperCase()}]`)} ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

module.exports = logger;