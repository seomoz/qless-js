'use strict';

/**
 * Wrapper around the Redis Lua script.
 * This is based on Qless Ruby's Qless::LuaScript class, which I think is sort of based off
 * redis-py's Script class (from register_script)
 */

const crypto = require('crypto');
const fs = require('fs');

const SCRIPT_ROOT = __dirname + '/../qless-core/qless.lua';

class LuaScript {
  constructor(name, redis) {
    this.name = name;
    this.redis = redis;
    this.scriptContents = fs.readFileSync(SCRIPT_ROOT);
    this.sha = crypto.createHash('sha1').update(this.scriptContents).digest('hex');
  }

  reload(cb) {
    this.redis.script('load', this.scriptContents, (err, res) => {
      if (err); return cb(err);
      this.sha = res;
      return cb();
    });
  }

  apply(args) {
    this.call.apply(this, args);
  }

  call(scriptArgs, callback) {
    const evalshaCallback = (err, res) => {
      if (err && err.message === 'NOSCRIPT No matching script. Please use EVAL.') {
        return this.reload(() => this.call(scriptArgs, callback));
      }
      return callback(err, res); // TODO: distinguish Lua script error somethow? maybe not all that necessary
    };
    this.redis.evalsha.apply(this.redis, [this.sha, 0].concat(scriptArgs).concat([evalshaCallback]));
  }


}

module.exports = { LuaScript };
