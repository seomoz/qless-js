'use strict';

const Promise = require('bluebird').Promise;
const Popper = require('./popper.js');
const Semaphore = require('./semaphore.js');

/**
 * Worker that runs multiple concurrent jobs.
 */
class Worker {

  constructor(client, config) {
    this.client = client;
    const queues = config.queues;
    this.interval = config.interval || 60000;
    this.popper = new Popper(client, queues);
    this.processConfig = config.processConfig;
    this.semaphore = new Semaphore(config.count);
    this.running = new Set();
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
    return this.semaphore.acquire()
      .then(() => this.popper.popNext(this.interval))
      .then((job) => {
        // Bail and wait for all running promises
        if (!job) return Promise.all(this.running);

        const process = job.process(this.processConfig);
        this.running.add(process);
        process
          .finally(() => {
            this.semaphore.release();
            this.running.delete(process);
          });

        // Try to run another job, waiting on the semaphore.
        return this.run();
      });
  }

}

module.exports = Worker;
