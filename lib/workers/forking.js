'use strict';

const Path = require('path');

const Promise = require('bluebird').Promise;
const workerpool = require('workerpool');

const logger = require('../logger.js');
const deepCopy = require('../util.js').deepCopy;

/**
 * Worker that spawns multiple subprocesses, each running a Multi worker. This
 * uses the `workerpool` module to manage all the subprocesses and respawning,
 * but it does not use `workerpool` for delegating tasks to each worker.
 */
class Worker {

  constructor(config) {
    this.processes = config.processes;
    this.pool = workerpool.pool(Path.resolve(__dirname, 'forking-workerpool.js'), {
      minWorkers: this.processes,
      maxWorkers: this.processes,
    });
    this.config = config;
    this.stopped = false;
  }

  /**
   * Stop the worker.
   *
   * If `force` is provided, workers should be terminated immediately. Otherwise,
   * workers will finish the jobs they have in progress.
   */
  stop(force) {
    this.stopped = true;
    if (force) {
      logger.warn('Forcefully terminating workers...');
      return this.pool.terminate(true);
    } else {
      logger.info('Gracefully terminating workers...');
      // This sends a signal indicating that the `Multi` worker in each process
      // should not take on any more jobs.
      this.pool.workers.forEach(worker => process.kill(worker.worker.pid, 'SIGQUIT'));
      return this.pool.terminate(false);
    }
  }

  /**
   * Process jobs.
   *
   * Returns a promise that resolves when the worker is stopped. Throws when there
   * is an unrecoverable exception.
   */
  run() {
    const workForever = (id) => {
      logger.info('Starting worker %s', id);

      const config = deepCopy(this.config);

      config.workdir = Path.join(this.config.workdir, `${id}`);

      if (this.stopped) {
        return id;
      }

      return this.pool.exec('work', [config])
        .then(() => {
          logger.info('Worker %s exited gracefully', id);
          return id;
        })
        .catch((error) => {
          logger.error('Worker %s died...', id, error);
          return workForever(id);
        });
    };

    const ids = Array.from(Array(this.processes).keys());

    // offload a function to a worker
    return Promise.map(ids, workForever)
      .then(() => logger.info('All workers finished'))
      .then(() => this.pool.terminate());
  }

}

module.exports = Worker;
