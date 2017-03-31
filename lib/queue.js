'use strict';

const uuid = require('uuid');

class Jobs {

  constructor(name, client) {
    this.name = name;
    this.client = client;
  }

  running(options) {
    const offset = (options && options.offset) || 0;
    const count = (options && options.count) || 25;
    return this.client.call('jobs', 'running', this.name, offset, count);
  }

  stalled(options) {
    const offset = (options && options.offset) || 0;
    const count = (options && options.count) || 25;
    return this.client.call('jobs', 'stalled', this.name, offset, count);
  }

  scheduled(options) {
    const offset = (options && options.offset) || 0;
    const count = (options && options.count) || 25;
    return this.client.call('jobs', 'scheduled', this.name, offset, count);
  }

  depends(options) {
    const offset = (options && options.offset) || 0;
    const count = (options && options.count) || 25;
    return this.client.call('jobs', 'depends', this.name, offset, count);
  }

  recurring(options) {
    const offset = (options && options.offset) || 0;
    const count = (options && options.count) || 25;
    return this.client.call('jobs', 'recurring', this.name, offset, count);
  }

}

class Queue {

  constructor(name, client) {
    this.name = name;
    this.client = client;
    this.jobs = new Jobs(name, client);
  }

  static makeJobId() {
    return uuid.v4().replace(/-/g, '');
  }

  getHeartbeat() {
    const key = `${this.name}-heartbeat`;
    return this.client.getConfig()
      .then(config => (config[key] || config.heartbeat));
  }

  setHeartbeat(value) {
    return this.client.setConfig(`${this.name}-heartbeat`, value);
  }

  counts() {
    return this.client.call('queues', this.name).then(JSON.parse);
  }

  pause() {
    return this.client.call('pause', this.name);
  }

  unpause() {
    return this.client.call('unpause', this.name);
  }

  /**
   * Make a job
   *
   * The following attributes are required:
   *  - klass
   *
   * The following attributes are optional:
   *  - jid (defaults to a uuid)
   *  - data (defaults to {}, must be JSON-serializable)
   *  - priority (higher is more urgent)
   *  - delay (in seconds)
   *  - tags (array of strings)
   *  - retries (how many times each job can be retried)
   *  - depends (array of string jids on which this job depends)
   */
  put(options) {
    // TODO(dan): should this yell if you provide an unsupported option?
    // Suppose you set options.prority [sic] -- it should yell at you for
    // misspelling "priority."
    return this.client.call(
      'put',
      this.client.workerName,
      this.name,
      options.jid || Queue.makeJobId(),
      options.klass,
      JSON.stringify(options.data || {}),
      options.delay || 0,
      'priority', options.priority || 0,
      'tags', JSON.stringify(options.tags || []),
      'retries', options.retries || 5,
      'depends', JSON.stringify(options.depends || []));
  }

  /**
   * Make a recurring job
   *
   * The following attributes are required:
   *  - klass
   *  - interval (seconds between jobs)
   *
   * The following attributes are optional:
   *  - jid (defaults to a uuid)
   *  - data (defaults to {}, must be JSON-serializable)
   *  - offset (delay in seconds for first job)
   *  - priority (higher is more urgent)
   *  - tags (array of strings)
   *  - retries (how many times each job can be retried)
   */
  recur(options) {
    // TODO(dan): should this yell if you provide an unsupported option?
    // Suppose you set options.prority [sic] -- it should yell at you for
    // misspelling "priority."
    return this.client.call(
      'recur',
      this.name,
      options.jid || Queue.makeJobId(),
      options.klass,
      JSON.stringify(options.data || {}),
      'interval', options.interval, options.offset || 0,
      'priority', options.priority || 0,
      'tags', JSON.stringify(options.tags || []),
      'retries', options.retries || 5);
  }

  /**
   * Pop a job from the queue.
   *
   * If a count is provided, at most `count` jobs will be returned in an array. If
   * no count is provided, then either a job will be returned or null.
   */
  pop(count) {
    count = count || 1;
    const self = this;
    return this.client.call('pop', this.name, this.client.workerName, count)
      .then(JSON.parse)
      .then((response) => {
        if (count > 1) {
          return response;
        } else if (response.length) {
          return response[0];
        } else {
          return null;
        }
      });
  }

  /**
   * Peek at the next job in the queue.
   *
   * If a count is provided, at most `count` jobs will be returned in an array. If
   * no count is provided, then either a job will be returned or null.
   */
  peek(count) {
    count = count || 1;
    const self = this;
    return this.client.call('peek', this.name, count)
      .then(JSON.parse)
      .then((response) => {
        if (count > 1) {
          return response;
        } else if (response.length) {
          return response[0];
        } else {
          return null;
        }
      });
  }

  /**
   * Return the current statistics for a given queue on a given date.
   * The results are returned are a JSON blob:
   *
   *     {
   *         'total'    : ...,
   *         'mean'     : ...,
   *         'variance' : ...,
   *         'histogram': [
   *             ...
   *         ]
   *     }
   *
   * The histogram's data points are at the second resolution for the first
   * minute, the minute resolution for the first hour, the 15-minute
   * resolution for the first day, the hour resolution for the first 3
   * days, and then at the day resolution from there on out. The
   * `histogram` key is a list of those values.
   */
  stats(date) {
    const now = (new Date()).getTime() / 1000.0;
    return this.client.call('stats', this.name, date || now)
      .then(JSON.parse);
  }

  length() {
    return this.client.call('length', this.name);
  }

}

module.exports = Queue;
