'use strict';

/**
 * Check if an object is empty.
 */
const isEmpty = (obj) => {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
};

/**
 * Lua's notion of tables is such that when serializing an empty table, it appears
 * as an object, not an array.
 */
const asArray = (obj) => {
  return isEmpty(obj) ? [] : obj;
};

module.exports = {
  isEmpty,
  asArray,
};
