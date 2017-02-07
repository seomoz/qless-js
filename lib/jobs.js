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

  tracked(cb) {
    this.client.call('track', makeCb(cb, val => {
      cb(null, JSON.parse(val));
    }));
  }
  
  // TODO: this is not tested, only provided for integration test.
  failedCounts(cb) {
    this.client.call('failed', makeCb(cb, val => {
      cb(null, JSON.parse(val));
    }));
  }

  // TODO: recurring jobs ("recur.get")
  get(jid, cb) {
    this.client.call('get', jid, makeCb(cb, result => {
      if (result) result = new job.Job(this.client, JSON.parse(result));
      cb(null, result);
    }));
  }
}

module.exports = { Jobs };
