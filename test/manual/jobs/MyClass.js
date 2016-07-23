'use strict';

const Promise = require('bluebird');

function *doSomeStuff() {
  console.log("doing some stuff");
  yield Promise.delay(2000);
  console.log("I've done some stuff");
  throw new Error('wombat power!');
  console.log("I've done some more stuff!");
}

function *perform(job) {
  console.log(`Performing job with foo=${job.data.foo}... please wait!`);
  yield doSomeStuff();
  console.log(`I'm out of here! Done with foo=${job.data.foo}`);
};

module.exports = require('./generator2job')(perform);

