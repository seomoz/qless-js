'use strict';

/**
 * Basic qless client object for interacting with qless.
 */

const redis = require('redis');
const os = require('os');
const process = require('process');

const luaScript = require('./lua_script');
const queue = require('./queue');
const jobs = require('./jobs');

class Client {
  /**
   * Parameters are passed through to redis.createClient()
   */
  constructor() {
    this.redis = redis.createClient.apply(redis, arguments);
    this._lua = new luaScript.LuaScript('qless', this.redis);
    this.jobs = new jobs.Jobs(this);
    this.workerName = [os.hostname(), process.env.HOST, process.pid.toString()].join('-');
  }

  /**
   * Args: command, arg1, arg1, ..., cb
   */
  call() {
    // convert arguments to real array
    const args = Array.prototype.slice.call(arguments, 0);
    const cb = args.pop();

    // Add "time" between command and rest of args
    const time = new Date().getTime() / 1000.0;
    args.splice(1, 0, time);
    this._lua.call(args, cb);
  }

  /**
   * Get a Queue object for the given queue name
   */
  queue(name) {
    // TODO: still not sure if we want to make all workers under one process have the same workerName.
    // Seems like they would just step on each other as they are independent (e.g., two workers working
    // on the same job and renewing each other's lock/lease on the job). This seems to be what the
    // Python ForkingWorker does, but perhaps they are not so independent under that model? Still it seems
    // possible that two workers could be working on the same job and there is no check to see if this is
    // happenning?
    return new queue.Queue(name, this, this.workerName);
  }
}

module.exports = { Client };
