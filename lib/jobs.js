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

  get(jid, cb) {
    this.client.call('get', jid, makeCb(cb, result => {
      if (result) {
        result = new job.Job(this.client, JSON.parse(result));
        cb(null, result);
        return;
      }

      this.client.call('recur.get', jid, makeCb(cb, recurResult => {
        if (recurResult) {
          result = new job.RecurringJob(this.client, JSON.parse(recurResult));
        }

        cb(null, result);
      }));
    }));
  }
}

module.exports = { Jobs };
