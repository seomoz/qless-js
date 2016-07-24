'use strict';

/**
 * Class for lazily accessing job information
 * See equivalent class in Ruby, Python qless
 */

class Jobs {
  constructor(client) {
    this.client = client;
  }

  // TODO: this is not tested, only provided for integration test.
  failedCounts(cb) {
    this.client.call('failed', (err, val) => {
      if (err) return cb(err);
      return cb(null, JSON.parse(val));
    });
  }
}

module.exports = { Jobs };
