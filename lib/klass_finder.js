'use strict'

let moduleDir;

module.exports = {
  setModuleDir(dir) {
    moduleDir = dir;
  },
  findClass(klassName) {
    return require(moduleDir + '/' + klassName);
  },
};

