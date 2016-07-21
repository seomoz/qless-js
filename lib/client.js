'use strict';

const redis = require('redis');

const luaScript = require('./lua_script');
const queue = require('./queue');

class Client {
  constructor() {
    this.redis = redis.createClient.apply(redis, arguments);
    this._lua = new luaScript.LuaScript('qless', this.redis);
  }

  /**
   * Args: command, arg1, arg1, ..., cb
   */
  call() {
    const command = arguments[0];

    // convert arguments to real array
    const args = Array.prototype.slice.call(arguments, 1);
    const cb = args.pop();

    const time = new Date().getTime() / 1000.0; // TODO: might have to convert to string.
    const luaScriptArgs = [command, time].concat(args);

    this._lua.call(luaScriptArgs, cb);
  }

  queueCounts() {
    // TODO
  }

  queue(name) {
    return new queue.Queue(name, this, "WORKER-NAME-TODO"); // TODO
  }

}

module.exports = { Client };
