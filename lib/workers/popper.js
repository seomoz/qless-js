'use strict';

const Promise = require('bluebird').Promise;
const logger = require('../logger.js');

/**
 * Implements a round-robin popping policy.
 *
 * Will attempt to pop from each queue in succession. If a job is popped from
 * one queue, the next pop will be attempted from the next queue. If no job is
 * found, it will wait the provided polling interval.
 */
class Popper {

  constructor(client, queues, interval) {
    this.client = client;
    this.queues = queues;
    this.interval = interval;

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
            logger.info('Sleeping %s ms...', this.interval);
            return Promise.delay(this.interval).then(() => this.pop());
          } else {
            // Reset the found state
            this.found = false;
          }
        }

        return job || this.pop();
      });
  }
}

module.exports = Popper;
