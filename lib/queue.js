'use strict';

/**
 * One queue (associated with one client and one particular worker)
 * Not meant to be instantiated directly, it's accessed with Client#queue(...)
 */

const _ = require('lodash');

const util = require('./util');
const makeCb = util.makeCb;
const job = require('./job');
const config = require('./config');

class Queue {
  constructor(name, client, workerName) {
    this.name = name;
    this.client = client;
    this.config = new config.Config(client);
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

  pause(cb) {
    this.client.call('pause', this.name, cb);
  }

  unpause(cb) {
    this.client.call('unpause', this.name, cb);
  }

  recur(klassName, data, interval, opts, cb) {
    this.client.call('recur',
        this.name,
        opts.jid || util.generateJid(),
        klassName,
        JSON.stringify(data),
        'interval', interval, opts.offset || 0,
        'priority', opts.priority || 0,
        'tags', JSON.stringify(opts.tags || []),
        'retries', opts.retries || 5,
        cb
    );
  }

  pop(cb) {
    this.multipop(null, cb);
  }

  multipop(count, cb) {
    this.client.call('pop', this.name, this.workerName, count || 1, makeCb(cb, jids => {
      const jobs = _.map(JSON.parse(jids), (j) => new job.Job(this.client, j, this.name));
      return cb(null, count ? jobs : (jobs[0] || null));
    }));
  }
}

module.exports = { Queue };
