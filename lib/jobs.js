'use strict';

const job = require('./job');
const makeCb = require('./util').makeCb;

/**
 * Class for lazily accessing job information
 * See equivalent class (Jobs, ClientJobs) in Ruby, Python qless
 */

class Jobs {
  constructor(client) {
    this.client = client;
  }

  // TODO: this is not tested, only provided for integration test.
  failedCounts(cb) {
    this.client.call('failed', makeCb(cb, val => {
      cb(null, JSON.parse(val));
    }));
  }

  // TODO: recurring jobs ("recur.get")
  get(jid, mainCb) {
    this.client.call('get', jid, makeCb(mainCb, result => {
      if (result) result = new job.Job(this.client, JSON.parse(result));
      cb(null, result);
    }));
  }
}

module.exports = { Jobs };
