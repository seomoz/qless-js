'use strict';

const Popper = require('./popper.js');

class Worker {

  constructor(client, config) {
    this.client = client;
    const queues = config.queues;
    const interval = config.interval || 60000;
    this.popper = new Popper(client, queues, interval);
    this.processConfig = config.processConfig;
  }

  /**
   * Stop the worker.
   *
   * This does not preempt any work -- it just causes the `run` promise to resolve
   * after the current job (if any) is finished.
   */
  stop() {
    this.popper.stop();
  }

  /**
   * Process jobs.
   *
   * Returns a promise that resolves when the worker is stopped. Throws when there
   * is an unrecoverable exception.
   */
  run() {
    return this.popper.pop()
      .then((job) => {
        if (job) {
          return job.process(this.processConfig).then(() => this.run());
        } else {
          return null;
        }
      });
  }

}

module.exports = Worker;
