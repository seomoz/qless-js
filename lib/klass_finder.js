'use strict';

const logger = require('./util').logger('klass_finder');

let moduleDir;

module.exports = {
  setModuleDir(dir) {
    moduleDir = dir;
  },

  findClass(klassName) {
    try {
      return require(moduleDir + '/' + klassName);
    } catch (e) {
      logger.error(`Couldn't load ${klassName}`);
      // TODO: there are different types of failures here -- couldn't find the file,
      // couldn't load it, etc. In the future we might want to be able to distinguish.
      // (First we might want to change completely the way finding a "klass" (Qless class) works, though.
      return null;
    }
  },
};
