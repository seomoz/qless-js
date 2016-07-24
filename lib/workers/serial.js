'use strict';

// TODO: set jid in the worker for debugging purposes? Python does it

const util = require('../util');
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
}


// it harder to test.
// require("./workers/serial").SerialWorker ??? seems slightly awkward
class SerialWorker extends Worker {
  run(cb) {
    this.reserve((err, job) => {
      if (err) return cb(err);
      if (!job) {
        logger.debug(`Nothing to do, waiting ${this.options.interval}ms`);
        return setTimeout(() => this.run(cb), this.options.interval);
      }

      logger.info(`Running a job, jid ${job.jid},  class: ${job.klassName}, data: ${JSON.stringify(job.data)}`);

      // TODO: set worker.jid here? Python version does, ruby version apparently does not
      job.perform((err) => {
        if (err) return cb(err); // Only happens with really bad errors, like redis errors
        setImmediate(() => this.run(cb));
      });
      // TODO: self.stop maybe to shutdown a worker
    });
  }
}

module.exports = { SerialWorker };
