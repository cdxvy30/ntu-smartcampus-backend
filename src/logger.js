const winston = require('winston');
const expressWinston = require('express-winston');
const { format, createLogger, transports } = require('winston');

export default createLogger({
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
  ),
  transports: [
    new transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

export const apiLogger = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/access.log',
    }),
  ],
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
  ),
  // eslint-disable-next-line max-len
  meta: true, // optional: control whether you want to log the meta data about the request (default to true)
  msg: 'HTTP {{req.method}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
  // eslint-disable-next-line max-len
  expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
  // eslint-disable-next-line max-len
  colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
  // eslint-disable-next-line max-len
  // ignoreRoute(req, res) { return false; }, // optional: allows to skip some log messages based on request and/or response
});
