'use strict';

const Promise = require('bluebird');

function *perform(job) {
  console.log(`Performing job with foo=${job.data.foo}... please wait!`);
  yield Promise.delay(2000);
  console.log(`I'm out of here! Done with foo=${job.data.foo}`);
  throw new Error('wombat power!');
};

module.exports = require('./generator2job')(perform);

