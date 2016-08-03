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
  queue(name, workerNameSuffix) {
    let workerName = this.workerName;
    if (workerNameSuffix) workerName += '-' + workerNameSuffix.toString();
    return new queue.Queue(name, this, workerName);
  }
}

module.exports = { Client };
