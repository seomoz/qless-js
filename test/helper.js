'use strict';

const Promise = require('bluebird').Promise;

class Cleaner {

  constructor(client) {
    this.client = client;
    this.empty = false;
  }

  before() {
    const self = this;
    return self.client.redis.keysAsync('*')
      .then((keys) => {
        if (keys.length > 0) {
          throw Error('Redis database not empty.');
        }
        self.empty = true;
      });
  }

  after() {
    if (this.empty) {
      return this.client.redis.flushdbAsync();
    } else {
      console.log('Not flushing db because it was not empty.');
      return null;
    }
  }
}

const stubDisposer = (obj, prop, stub) => {
  const original = obj[prop];
  return Promise.try(() => {
    obj[prop] = stub;
    return stub;
  }).disposer(() => {
    obj[prop] = original;
  });
};

module.exports = {
  Cleaner,
  stubDisposer,
};
