// TODO: set jid in the worker for debugging purposes? Python does it

const util = require('../util');

const DEFAULT_INTERVAL = 5000; // ms
class Worker {
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


class SerialWorker extends Worker {
  run(cb) {
    this.reserve((err, job) => {
      if (err) return cb(err);
      if (!job) return setTimeout(() => this.run(cb), this.options.interval);


      // TODO: set worker.jid here? Python version does, ruby version apparently does not
      job.perform((err) => {
        if (err) return cb(err); // TODO: would this really ever happen?
        setImmediate(() => this.run(cb));
      });
      // TODO: self.shutdown maybe to shutdown a worker? would probably make sense with JS
    });
  }
}
