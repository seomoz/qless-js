'use strict';

// TODO: set jid in the worker for debugging purposes? Python does it

const util = require('../util');
const logger = util.logger('worker');

const DEFAULT_INTERVAL = 5000; // ms
class Worker { // TODO TODO move to different file or something, probablye
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


// TODO TODO what should this class really be called in the export, or should it just be the exported thing? that makes
// it harder to test.
// require("./workers/serial").SerialWorker ??? seems slightly awkward
class SerialWorker extends Worker {
  run(cb) {
    this.reserve((err, job) => {
      if (err) return cb(err);
      if (!job) {
        logger.debug('Nothing to do, waiting ', this.options.interval);
        return setTimeout(() => this.run(cb), this.options.interval);
      }

      logger.info(`Running a job, jid ${job.jid},  class: ${job.klassName}, data: ${JSON.stringify(job.data)}`);

      // TODO: set worker.jid here? Python version does, ruby version apparently does not
      job.perform((err) => {
        if (err) return cb(err); // Only happens with really bad errors, like redis errors
        setImmediate(() => this.run(cb));
      });
      // TODO: self.shutdown maybe to shutdown a worker? would probably make sense with JS
    });
  }
}

module.exports = { SerialWorker };
