'use strict';

/**
 * Turns a qless Job's "class" (also spelled "klass") into something which can
 * be run. For now, a "class" is just a module that exports a "perform" function.
 * You can set the directory where modules are looked for by calling setModuleDir.
 * e.g., if there is a job directory located relative to the file that calls this:
 *   qless.klassFinder.setModuleDir(__dirname + "/myjobsdirectory/");
 */

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
      logger.error(`Couldn't load ${klassName} in ${moduleDir}: ${e}`);
      // TODO: there are different types of failures here -- couldn't find the file,
      // couldn't load it, etc. In the future we might want to be able to distinguish.
      // (First we might want to change completely the way finding a "klass" (Qless class) works, though.
      return null;
    }
  },
};
