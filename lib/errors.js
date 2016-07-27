'use strict';

/**
 * Custom errors for use throught Qless.
 *
 * Can be thrown with:
 *   throw new errors.CouldntLoadClass('my message');
 *   cb(new errors.CouldntLoadClass('my message'));
 * Checks can be done with:
 *   const error = require('./errors');
 *   catch(e) { if (err.name instanceof errors.CouldntLoadClass) { ... } }
 *   (err, val) => { if (err && err instanceof errors.CouldntLoadClass) { ... } }
 * Externally use:
 *   const qless = require('qless');
 *   if (err instanceof qless.errors.CouldntLoadClass) { ... }
 * Error will have the name "qless.errors.CouldntLoadClass"
 *
 */

const QLESS_ERROR_NAME_PREFIX = 'qless.errors.';

const ERRORS = [
  'LuaScriptError',
  'CouldntLoadClass',
  'ClassLackingPerformMethod',
];

module.exports = ERRORS.reduce((exportTable, errorName) => {
  exportTable[errorName] = function createError(msg) {
    const error = Error.call(this, msg);
    this.name = QLESS_ERROR_NAME_PREFIX + errorName;
    this.message = error.message;
    this.stack = this.name + ': ' + error.stack;
  };
  exportTable[errorName].prototype = Object.create(Error.prototype);
  exportTable[errorName].prototype.constructor = errorName;
  return exportTable;
}, {});
