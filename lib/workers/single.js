'use strict';

const Popper = require('./popper.js');
const Client = require('../client.js');

class Worker {

  constructor(config) {
    this.client = config.client || new Client(config.clientConfig);
    const queues = config.queues || config.queueNames.map(name => this.client.queue(name));
    this.interval = config.interval || 60000;
    this.popper = new Popper(this.client, queues);
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
    return this.popper.popNext(this.interval)
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
