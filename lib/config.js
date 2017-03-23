'use strict';


/**
 * All our configuration operations
 *
 * A class that allows us to change and manipulate qless config
 */

class Config {

    constructor(client) {
      this.client = client;
    }

    // Test if necessary
    getAll(cb) {
      this.client.call('config.get', (err, res) => {
        if (!err) res = JSON.parse(res);
        cb(err, res);
      });
    }

    get(key, cb) {
      this.client.call('config.get', key, cb);
    }

    set(key, value, cb) {
      this.client.call('config.set', key, value, cb);
    }

    unset(key, cb) {
      this.client.call('config.unset', key, cb);
    }

    clear(cb) {
      this.getAll((err, res) => {
        if (err) cb(err, res);

        Object.keys(res).forEach((key) => {
          this.client.call('config.unset', key, (e, r) => {
            if (err) cb(e, r);
          });
        });

        cb(err, res);
      });
    }
}

module.exports = { Config };
