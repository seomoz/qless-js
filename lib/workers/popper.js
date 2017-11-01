'use strict';

const Promise = require('bluebird').Promise;
const logger = require('../logger.js');

/**
 * Implements a round-robin popping policy.
 *
 * Will attempt to pop from each queue in succession. If a job is popped from
 * one queue, the next pop will be attempted from the next queue.
 */
class Popper {

  constructor(client, queues) {
    this.client = client;
    this.queues = queues;

    this.index = 0;
    this.found = false;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }

  /**
   * Pop a job from the queues.
   *
   * Returns a promise that resolves with the popped job. After this has been
   * stopped, successive call to `pop` will resolve immediately with `null`.
   */
  pop() {
    if (this.stopped) return Promise.resolve(null);

    return this.queues[this.index].pop()
      .then((job) => {
        // Advance to the next queue for the next iteration
        this.index = (this.index + 1) % this.queues.length;
        this.found = this.found || !!job;

        if (this.index === 0) {
          if (!this.found) {
            return null;
          } else {
            // Reset the found state
            this.found = false;
          }
        }

        return job || this.pop();
      });
  }

  /**
   * Pop the next job available on the queues.
   *
   * This differs from `pop` in that it will not return `null`, but instead wait
   * a prescribed interval before trying to `pop` again.
   */
  popNext(interval) {
    return this.pop()
      .then((job) => {
        if (job) {
          return job;
        } else if (this.stopped) {
          return null;
        }
        logger.info('Sleeping %s ms...', interval);
        return Promise.delay(interval).then(() => this.popNext(interval));
      });
  }
}

module.exports = Popper;
