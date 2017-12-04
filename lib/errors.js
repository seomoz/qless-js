'use strict';

const util = require('util');

const ExtendableError = require('es6-error');

/**
 * The top-level class for all of our errors.
 */
function QlessError() { }

util.inherits(QlessError, ExtendableError);

module.exports = {
  QlessError,
};
