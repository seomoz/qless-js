'use strict';

const Promise = require('bluebird').Promise;
const fs = require('fs');
const os = require('os');
const path = require('path');
const redis = require('redis');
const Queue = require('./queue.js');
const Job = require('./job.js');
const logger = require('./logger.js');
const Jobs = require('./jobs.js');

Promise.promisifyAll(fs);
Promise.promisifyAll(redis.RedisClient.prototype);

class Client {

  constructor(config) {
    this.config = config;
    this.redis = redis.createClient(config);
    this.path = path.join(__dirname, 'qless-core', 'qless.lua');
    this.sha = null;
    this.jobs = new Jobs(this);
    this.workerName = (config && config.hostname) || os.hostname();
  }

  // Return a new disposer
  static disposer(config) {
    return Promise.resolve(new Client(config)).disposer(client => client.quit());
  }

  // Use a client only for the duration of handler
  static using(config, handler) {
    return Promise.using(Client.disposer(config), handler);
  }

  // Close this client
  quit() {
    logger.debug('Closing client.');
    this.redis.quit();
  }

  // Invoke a qless command
  call() {
    const now = (new Date()).getTime() / 1000.0;
    const args = Array.from(arguments);
    const command = args.shift();
    return this.load()
      .then((sha) => {
        logger.debug('Calling %s', command, { now, args });
        return this.redis.evalshaAsync([sha, 0, command, now].concat(args));
      })
      .then((response) => {
        logger.debug('Response: %s', response);
        return response;
      });
  }

  // Load the Lua scripts
  load() {
    if (this.sha) return Promise.resolve(this.sha);

    return fs.readFileAsync(this.path)
      .then(contents => this.redis.scriptAsync('load', contents))
      .then((sha) => {
        logger.debug('Loaded SHA %s', sha);
        this.sha = sha;
        return this.sha;
      });
  }

  // Get a specific job by id
  job(jid) {
    return this.call('get', jid)
      .then((job) => {
        if (job) {
          // It's a normal job
          return new Job(this, JSON.parse(job));
        } else {
          // Try to get a recurring job
          return this.call('recur.get', jid)
            .then((recurringJob) => {
              if (recurringJob) {
                return JSON.parse(recurringJob);
              } else {
                return null;
              }
            });
        }
      });
  }

  // Get a queue
  queue(name) {
    return new Queue(name, this);
  }

  // Track jobs in bulk
  track() {
    return Promise.map(arguments, jid => this.call('track', 'track', jid).thenReturn(jid));
  }

  // Untrack jobs in bulk
  untrack() {
    return Promise.map(arguments, jid => this.call('track', 'untrack', jid).thenReturn(jid));
  }

  // Cancel jobs in bulk
  cancel() {
    const args = ['cancel'].concat(Array.from(arguments));
    return this.call.apply(this, args);
  }

  // Get the configuration
  getConfig(name) {
    if (name) {
      return this.call('config.get', name)
        .then((response) => {
          try {
            return JSON.parse(response);
          } catch (err) {
            return response;
          }
        });
    } else {
      return this.call('config.get').then(JSON.parse);
    }
  }

  // Set a configuration option
  setConfig(name, value) {
    return this.call('config.set', name, JSON.stringify(value));
  }

}

module.exports = Client;
