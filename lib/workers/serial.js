'use strict';

/**
 * Simplest type of worker. Keeps popping off jobs and processing them,
 * one after the other.
 */

// TODO: set jid in the worker for debugging purposes? Python does it

const util = require('../util');
const makeCb = util.makeCb;
const errors = require('../errors');
const logger = util.logger('worker');

const DEFAULT_INTERVAL = 5000; // ms
class Worker { // when have other kinds of workers, can move to a different file
  constructor(queueName, client, options) {
    this.client = client;
    // TODO: multiple queues this.queues = queueNames.map(name => client.queue(name));
    this.queue = client.queue(queueName);
    this.options = options || {};
    this.options.interval = this.options.interval || DEFAULT_INTERVAL;
  }

  reserve(cb) {
    this.queue.pop(cb);
  }

  perform(job, cb) {
    job.perform(err => {
      if (err) return this.failJob(job, err, cb);
      return this.tryComplete(job, cb);
    });
  }

  tryComplete(job, cb) {
    if (job.isStateChanged()) return cb();
    job.complete(err => {
      if (err && err instanceof errors.LuaScriptError) {
        // There's not much we can do here. Complete fails in a few cases:
        //   - The job is already failed (i.e. by another worker)
        //   - The job is being worked on by another worker
        //   - The job has been cancelled
        //
        // We don't want to (or are able to) fail the job with this error in
        // any of these cases, so the best we can do is log the failure.
        logger.error(`Failed to complete ${job}: ${err.message}`);
        return cb();
      } else if (err) {
        return cb(err);
      } else {
        return cb();
      }
    });
  }

  failJob(job, err, cb) {
    let group;
    let message;

    if (err instanceof Error) {
      group = err.name;
      message = `${err.message}\n\n${err.stack}`;
    } else {
      group = message = err.toString();
    }

    logger.error(`Got ${group} failure from ${job}: ${message}`);

    job.fail(group, message, failErr => {
      if (failErr instanceof errors.LuaScriptError) {
        // There's not much we can do here. Another worker may have cancelled it,
        // or we might not own the job, etc. Logging is the best we can do.
        logger.error(`Failed to fail ${job}: ${message}`);
        return cb();
      }
      return cb(failErr);
    });
  }

}

class SerialWorker extends Worker {
  // Consider using async.waterfall for this function (as of 7/23/2016 we don't use async in qless)
  run(cb) {
    this.reserve(makeCb(cb, job => {
      if (!job) {
        logger.debug(`Nothing to do, waiting ${this.options.interval}ms`);
        return setTimeout(() => this.run(cb), this.options.interval);
      }

      logger.info(`Running a job, jid ${job.jid},  class: ${job.klassName}, data: ${JSON.stringify(job.data)}`);

      // TODO: set worker.jid here? Python version does, ruby version apparently does not
      this.perform(job, (performErr) => {
        if (performErr) return cb(performErr); // Only happens with really bad errors, like redis errors
        setImmediate(() => this.run(cb));
      });
      // TODO: self.stop maybe to shutdown a worker
    }));
  }
}

module.exports = { SerialWorker };
