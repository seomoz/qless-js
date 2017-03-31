'use strict';

const Promise = require('bluebird').Promise;
const Deque = require('double-ended-queue');

class Semaphore {

  constructor(count) {
    this.count = count;
    this.queue = new Deque();
  }

  /**
   * Return a promise that's resolved when the sempahore is available.
   */
  acquire() {
    return new Promise((resolve) => {
      if (this.count > 0) {
        this.count -= 1;
        return resolve();
      } else {
        return this.queue.push(resolve);
      }
    });
  }

  /**
   * Release the semaphore.
   */
  release() {
    if (this.count === 0) {
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
        return 0;
      }
    }
    this.count += 1;
    return this.count;
  }

  /**
   * Run a function / promise while holding a lock.
   */
  using(fn) {
    const disposer = Promise
      .try(() => this.acquire())
      .disposer(() => this.release());
    return Promise.using(disposer, fn);
  }

}

module.exports = Semaphore;
