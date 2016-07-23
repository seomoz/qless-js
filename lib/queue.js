'use strict';

const _ = require('lodash');

const util = require('./util');
const job = require('./job');

/**
 * One queue (associated with one client and one particular worker)
 */
class Queue {
  constructor(name, client, workerName) {
    this.name = name;
    this.client = client;
    this.workerName = workerName; // TODO -- might want to get from client, but given how JS works (more like greenlets than ruby 1 process), probably ok now
    // "_hb" are in Python only -- what are these?
  }

  running(start, count, cb) {
    this.client.call('jobs', 'running', this.name, start || 0, count || 25, cb);
  }
  stalled(start, count, cb) {
    this.client.call('jobs', 'stalled', this.name, start || 0, count || 25, cb);
  }
  scheduled(start, count, cb) {
    this.client.call('jobs', 'scheduled', this.name, start || 0, count || 25, cb);
  }

  // possible opts: jid, delay, priority, tags, retries, depends
  // TODO: klassName? how this is going to work in Javascript...
  put(klassName, data, opts, cb) {
    this.client.call('put', this.workerName, this.name,
        opts.jid || util.generateJid(),
        klassName,
        JSON.stringify(data),
        opts.delay || 0,
        'priority', opts.priority || 0,
        'tags', JSON.stringify(opts.tags || []),
        'retries', opts.retries || 5,
        'depends', JSON.stringify(opts.depends || []),
        cb);
  }

  pop(cb) {
    this.popMany(null, cb);
  }

  popMany(count, cb) {
    this.client.call('pop', this.name, this.workerName, count || 1, (err, jids) => {
      if (err) return cb(err);
      const jobs = _.map(JSON.parse(jids), j => new job.Job(this.client, j));
      return cb(null, count ? jobs : (jobs[0] || null));
    });
  }
}

module.exports = { Queue };
