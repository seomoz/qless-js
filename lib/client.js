'use strict';

/**
 * Basic qless client object for interacting with qless.
 */

const redis = require('redis');

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
  }

  /**
   * Args: command, arg1, arg1, ..., cb
   */
  call() {
    const command = arguments[0];

    // convert arguments to real array
    const args = Array.prototype.slice.call(arguments, 1);
    const cb = args.pop();

    const time = new Date().getTime() / 1000.0;
    const luaScriptArgs = [command, time].concat(args);

    this._lua.call(luaScriptArgs, cb);
  }

  /**
   * Get a Queue object for the given queue name
   */
  queue(name) {
    return new queue.Queue(name, this, 'ONLY-ONE-WORKER-SUPPORTED-TODO'); // TODO
  }
}

module.exports = { Client };
