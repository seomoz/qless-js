'use strict';

const Path = require('path');

const Promise = require('bluebird').Promise;
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const Popper = require('./popper.js');
const Semaphore = require('./semaphore.js');
const Client = require('../client.js');
const logger = require('../logger.js');

/**
 * Worker that runs multiple concurrent jobs.
 */
class Worker {

  constructor(config) {
    this.client = config.client || new Client(config.clientConfig);
    const queues = config.queues || config.queueNames.map(name => this.client.queue(name));
    this.interval = config.interval || 60000;
    this.popper = new Popper(this.client, queues);
    this.processConfig = config.processConfig;
    this.semaphore = new Semaphore(config.count);
    this.running = new Set();
    this.workdir = config.workdir;
  }

  cleanWorkDir(directory) {
    logger.warn(`Cleaning ${directory}...`);
    rimraf.sync(this.workdir);
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
   * Try to get a job via the popper, but if none is available, wait for the
   * earlier of either 1) the passage of an interval or 2) the completion of
   * a running job, before trying to pop again.
   */
  pop() {
    return this.popper.pop()
      .then((job) => {
        if (job) {
          return job;
        } else if (this.popper.stopped) {
          return null;
        }
        return Promise.race([
          Promise.delay(this.interval),
          Promise.race(this.running),
        ]).then(() => this.pop());
      });
  }

  /**
   * Process jobs.
   *
   * Returns a promise that resolves when the worker is stopped. Throws when there
   * is an unrecoverable exception.
   */
  run() {
    this.cleanWorkDir(this.workdir);

    return this.semaphore.acquire()
      .then(() => this.pop())
      .then((job) => {
        // Bail and wait for all running promises
        if (!job) return Promise.all(this.running);

        const jobWorkdir = Path.join(this.workdir, job.jid);

        mkdirp.sync(jobWorkdir);

        job.workdir = jobWorkdir;

        const process = job.process(this.processConfig);
        this.running.add(process);
        process
          .finally(() => {
            this.semaphore.release();
            this.running.delete(process);
            this.cleanWorkDir(jobWorkdir);
          });

        // Try to run another job, waiting on the semaphore.
        return this.run();
      });
  }

}

module.exports = Worker;
