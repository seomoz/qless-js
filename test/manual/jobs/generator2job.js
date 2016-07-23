'use strict';

const co = require('co');

module.exports = function generator2job(generatorFn) {
  return {
    perform(job, cb) {
      co(generatorFn(job)).then(val => cb(), err => cb(err))
    }
  };
}
