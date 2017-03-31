'use strict';

const winston = require('winston');
const Process = require('process');

const formatMeta = (meta) => {
  if (!meta || !Object.keys(meta).length) {
    return '';
  } else if (meta.stack) {
    // Errors provided as meta get turned into objects
    return `\n${meta.stack}`;
  } else {
    return ` | ${JSON.stringify(meta)}`;
  }
};

const logger = new winston.Logger({
  level: 'warn',
  transports: [
    new winston.transports.Console({
      formatter: (options) => {
        const prefix = `${new Date()} | PID ${Process.pid} | ${options.level.toUpperCase()}`;
        return `${prefix} | ${options.message}${formatMeta(options.meta)}`;
      },
    }),
  ],
});

module.exports = logger;
