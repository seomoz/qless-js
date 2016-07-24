'use strict';

/**
 * Wrapper around the Redis Lua script.
 * This is based on Qless Ruby's Qless::LuaScript class, which I think is sort of based off
 * redis-py's Script class (from register_script)
 */

const crypto = require('crypto');
const fs = require('fs');
const errors = require('./errors');

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
      if (err) return cb(err);
      this.sha = res;
      return cb();
    });
  }

  call(scriptArgs, callback) {
    const evalshaCallback = (err, res) => {
      if (err && err.message === 'NOSCRIPT No matching script. Please use EVAL.') {
        // Script not loaded in Redis. Load it.
        return this.reload(reloadErr => {
          if (reloadErr) return callback(reloadErr);
          this.call(scriptArgs, callback);
        });
      } else if (err) {
        // Lua Script Error
        const regexMatch = err.message.match(/user_script:\d+:\s*(\w+.+$)/);
        if (regexMatch) return callback(new errors.LuaScriptError(regexMatch[1]));
      }

      // Success, or other error:
      return callback(err, res);
    };

    this.redis.evalsha.apply(this.redis, [this.sha, 0].concat(scriptArgs).concat([evalshaCallback]));
  }


}

module.exports = { LuaScript };
