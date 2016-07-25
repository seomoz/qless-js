'use strict';

/**
 * Various utilities.
 */

const crypto = require('crypto');
const debug = require('debug');
const LOG_APP_NAME = 'qless';
const LOG_LEVELS = ['debug', 'info', 'error'];

// Used by generateJid()
function byteToPaddedHex(byteVal) {
  return (0x100 + byteVal).toString(16).substr(1);
}


/**
 * Generates a new securely random, 16-byte hex qless job id.
 */
function generateJid() {
  const bytes = Array.from(crypto.randomBytes(16));
  return bytes.map(byteToPaddedHex).join('');
}

/**
 * Generate a properly namespaced logger with the debug(), info() etc.
 * functions for the given module name.
 */
function logger(module) {
  const result = {};
  for (const level of LOG_LEVELS) {
    result[level] = debug(`${LOG_APP_NAME}:${module}:${level}`);
  }
  return result;
}

/**
 * Makes a callback that:
 * - on error, calls the callback function with the error and value
 * - on success, calls the success function with one argument, the value.
 * Encapsulates the common pattern:
 *   foo(arg1, arg2, (err, val) => {
 *     if (err) return cb err;
 *     // do something with val...
 *   });
 */
function makeCb(errorCb, successCb) {
  return (err, value) => {
    if (err) return errorCb(err, value);
    successCb(value);
  };
}

module.exports = { generateJid, logger, makeCb };
