'use strict'

const logger = require('./util').logger('klass_finder');

let moduleDir;

module.exports = {
  setModuleDir(dir) {
    moduleDir = dir;
  },

  findClass(klassName) {
    try {
      return require(moduleDir + '/' + klassName);
    } catch(e) {
      logger.error(`Couldn't find ${klassName}`);
      return null;
    }
  },
};

