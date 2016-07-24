'use strict';

const crypto = require('crypto');
const debug = require('debug');
const LOG_APP_NAME = 'qless';
const LOG_LEVELS = ['debug', 'info', 'error'];

// Used by generateJid()
function byteToPaddedHex(byteVal) {
  return (0x100 + byteVal).toString(16).substr(1);
}

function generateJid() {
  const bytes = Array.from(crypto.randomBytes(16));
  return bytes.map(byteToPaddedHex).join('');
}

/**
 * Generate a properly named space logger with the debug(), info() etc functions for the given module name.
 */
function logger(module) {
  const result = {};
  for (const level of LOG_LEVELS) {
    result[level] = debug(`${LOG_APP_NAME}:${module}:${level}`);
  }
  return result;
}

module.exports = { generateJid, logger };
