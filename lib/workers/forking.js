'use strict';

const Path = require('path');

const bytes = require('bytes');
const Promise = require('bluebird').Promise;
const workerpool = require('workerpool');
const usage = Promise.promisifyAll(require('usage'));

const logger = require('../logger.js');
const deepCopy = require('../util.js').deepCopy;

/**
 * Worker that spawns multiple subprocesses, each running a Multi worker. This
 * uses the `workerpool` module to manage all the subprocesses and respawning,
 * but it does not use `workerpool` for delegating tasks to each worker.
 */
class Worker {

  constructor(config) {
    this.config = config;
    this.stopped = false;
    this.memory = {
      max: Infinity,
      interval: 60000,
      ...config.memory,
    };
    this.processes = config.processes;
    this.pool = workerpool.pool(Path.resolve(__dirname, 'forking-workerpool.js'), this.getForkOptions());
  }

  getForkOptions() {
    const forkOptions = {
      minWorkers: this.processes,
      maxWorkers: this.processes,
    };
    if (this.memory.max !== Infinity) {
      // leave a 100MB threshold for node.js garbage collector
      // to start GC earlier than it hits kill threshold
      const memoryThreshold = 100;
      const maxMemoryInMb = Math.floor((this.memory.max / 1024 / 1024) - memoryThreshold);
      forkOptions.execArgv = [`--max-old-space-size=${maxMemoryInMb}`];
    }

    return forkOptions;
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
   * Monitor child process resource usage
   */
  async monitor() {
    logger.info(`Limiting each process to ${bytes(this.memory.max)}`);

    while (!this.stopped) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.delay(this.memory.interval);

      for (const child of this.pool.workers) {
        const pid = child.worker.pid;

        logger.debug(`Checking memory for ${pid}`);
        // eslint-disable-next-line no-await-in-loop
        const { memory } = await usage.lookupAsync(pid);

        logger.debug(`Process ${pid} using ${bytes(this.memory.max)}`);
        if (memory > this.memory.max) {
          logger.warn(`Killing child ${pid} for exceeding memory limit ${bytes(memory)} (${memory}) > ${bytes(this.memory.max)} (${this.memory.max})`);
          child.worker.kill('SIGTERM');
        }
      }
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
    const workers = Promise.map(ids, workForever)
      .then(() => logger.info('All workers finished'))
      .then(() => this.pool.terminate());
    const monitor = this.monitor();

    return Promise.all([workers, monitor]);
  }

}

module.exports = Worker;
