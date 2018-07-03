'use strict';

const workerpool = require('workerpool');

const Promise = require('bluebird').Promise;
const Path = require('path');
const logger = require('./logger.js');

class Job {

  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.forkDisabled = false;

    // Shared between all Job classes
    this.jid = config.jid;
    this.priority = config.priority;
    this.klassName = config.klass;
    this.queueName = config.queue;
    this.tags = config.tags;
    this.data = JSON.parse(config.data);

    // Specific to non-recurring jobs
    this.state = config.state;
    this.tracked = config.tracked;
    this.failure = config.failure;
    this.history = config.history;
    this.dependents = config.dependents;
    this.dependencies = config.dependencies;
    this.expiresAt = config.expires;
    this.originalRetries = config.retries;
    this.retriesLeft = config.remaining;
    this.workerName = config.worker;
    this.spawnedFromJid = config.spawned_from_jid || null;
  }

  /**
   * Given a string name of a class, return the corresponding class
   *
   * Split the provided name by `/`, and import the longest working prefix. The
   * remaining components will be treated as attributes off of the import.
   *
   * For example, consider 'some/package/file.js/property/class'. We would
   * traverse this as:
   *
   *  - import 'some/package/file.js/property/class' (failed)
   *  - import 'some/package/file.js/property', get 'class' attribute (failed)
   *  - import 'some/package/file.js', get 'property.class' attribute (success)
   */
  static import(name) {
    const segments = name.split(Path.sep);
    const attributes = [];
    const getter = (obj, key) => obj[key];
    while (segments.length) {
      const joined = segments.join(Path.sep);
      let result = null;
      try {
        logger.debug('Trying to import %s...', joined);
        // eslint-disable-next-line global-require, import/no-dynamic-require
        result = require(joined);
      } catch (err) {
        attributes.push(segments.pop());
      }

      if (result) {
        try {
          logger.debug('Getting attributes [%s] of %s', attributes.join(', '), joined);
          result = attributes.reduce(getter, result);
        } catch (err) {
          break;
        }

        // If there's no such attribute, break out of the loop and throw
        if (!result) break;

        logger.debug('Found "%s"', result.name);
        return result;
      }
    }
    throw Error(`Could not find ${name}`);
  }

  disableFork() {
    this.forkDisabled = true;
  }

  enableFork() {
    this.forkDisabled = false;
  }

  forkEnabled() {
    if (this.forkDisabled || (process.env.DISABLE_QLESS_JOB_FORK === 'true')) {
      return false;
    }
    return true;
  }

  fork(thunk) {
    if (this.forkEnabled()) {
      const pool = workerpool.pool(Path.resolve(__dirname, 'workers/forking-workerpool.js'), {
        minWorkers: 1,
        maxWorkers: 1,
      });
      const final = () => pool.terminate(true);

      const promise = pool.exec('fork', [this.client.config, this.config])
        .catch((error) => {
          return final().then(() => {
            throw error;
          });
        })
        .then(final);

      return this.heartbeatUntilPromise(promise);
    } else {
      return thunk();
    }
  }

  setPriority(priority) {
    return this.client.call('priority', this.jid, priority)
      .then(() => {
        this.priority = priority;
        return this.priority;
      });
  }

  getQueue() {
    return this.client.queue(this.queueName);
  }

  /**
   * Get the class that corresponds to this klassName.
   *
   * A note on security -- abolute paths or those starting with a . are not
   * allowed. By disallowing them, we require that the job must be available in
   * node_modules, which allows for some amount of sandboxing. This, of course,
   * does not preclude the possibility of job code importing arbitrary modules.
   * It merely means that only job modules that have been installed in this
   * environment are available.
   *
   * If the `allowPaths` option is provided, any `require` is accepted.
   */
  getKlass(options) {
    const allowPaths = options && options.allowPaths;
    const name = Path.normalize(this.klassName);
    if (!allowPaths && (name.startsWith('.') || name.startsWith('/'))) {
      throw Error('Absolute and . paths are are not allowed.');
    }
    return Job.import(name);
  }

  cancel() {
    return this.client.call('cancel', this.jid);
  }

  tag() {
    return this.client.call.apply(
      this.client, ['tag', 'add', this.jid].concat(Array.from(arguments)));
  }

  untag() {
    return this.client.call.apply(
      this.client, ['tag', 'remove', this.jid].concat(Array.from(arguments)));
  }

  getTtl() {
    const now = (new Date()).getTime() / 1000.0;
    return this.expiresAt - now;
  }

  /**
   * Process this job.
   *
   * The function that's ultimately called _must_ return a Promise.
   *
   * The function that's called depends on what's available. It will first try to
   * see if there is a method `queueName` on the class itself. Failing that, it
   * will look for a method called 'process' on the class.
   *
   * Options may be provided, which are passed to `getKlass`.
   */
  process(options) {
    return Promise
      .try(() => {
        const klass = this.getKlass(options);
        const method = klass[this.queueName] || klass.process;
        if (method) {
          return method(this);
        } else {
          throw Error(`No method ${this.queueName} or process`);
        }
      })
      .catch((error) => {
        const group = `${this.queueName}-${error.name}`;
        const message = error.stack;
        logger.error('Job %s failed in group %s', this.jid, group, error);
        return this.fail(group, message);
      })
      .catch(error => logger.error('Failed to fail job %s', this.jid, error));
  }

  /**
   * Move this job out of its existing state and into another queue. If a worker
   * has been given this job, then that worker's attempts to heartbeat that job
   * will fail. Like `Queue.put`, this accepts a delay, and dependencies.
   */
  move(queue, options) {
    const opts = {
      jid: this.jid,
      klass: this.klassName,
      data: this.data,
      priority: this.priority,
      delay: (options && options.delay) || 0,
      tags: this.tags,
      retries: this.originalRetries,
      depends: (options && options.depends) || [],
    };
    logger.info('Moving job %s to %s', this.jid, queue);
    return this.client.queue(queue).put(opts);
  }

  complete(next, options) {
    const args = [
      'complete', this.jid, this.client.workerName, this.queueName,
      JSON.stringify(this.data),
    ];
    if (next) {
      args.push(
        'next', next,
        'delay', (options && options.delay) || 0,
        'depends', JSON.stringify((options && options.depends) || []));
      logger.info('Advancing job %s to %s', this.jid, next);
    } else {
      logger.info('Completing job %s', this.jid);
    }
    return this.client.call.apply(this.client, args);
  }

  heartbeat() {
    return this.client
      .call('heartbeat', this.jid, this.client.workerName, JSON.stringify(this.data))
      .then((expiration) => {
        logger.info('Heartbeated job %s, ttl=%s', this.jid, this.getTtl());
        this.expiresAt = expiration;
        return expiration;
      });
  }

  /**
   * Heartbeat as needed, until a promise resolves.
   *
   * Before the job lock is lost, the heartbeat is run. The padding controls how long
   * (in seconds) before the job lock loss to run the heartbeat. The default value is
   * 10, meaning that the heartbeat will run 10 seconds before the lock is set to
   * expire.
   */
  heartbeatUntilPromise(promise, padding) {
    // The promise is wrapped in Bluebird to ensure it adheres to the expected API
    const wrappedPromise = Promise.resolve(promise);
    // Default to 10 seconds
    padding = padding || 10;

    const poll = () => {
      // Heartbeat when `padding` seconds remain (converted to milliseconds)
      const interval = (this.getTtl() - padding) * 1000;
      return wrappedPromise.timeout(interval).catch(() => {
        if (wrappedPromise.isPending()) {
          return this.heartbeat().then(poll);
        }
        return wrappedPromise;
      });
    };

    return poll();
  }

  fail(group, message) {
    logger.info('Failing job %s in group %s', this.jid, group);
    return this.client.call(
      'fail', this.jid, this.client.workerName, group, message, JSON.stringify(this.data));
  }

  track() {
    return this.client.call('track', 'track', this.jid);
  }

  untrack() {
    return this.client.call('track', 'untrack', this.jid);
  }

  /**
   * Retry a job, providing an optional group and message.
   *
   * If provided, the group and message will be used should the retries be
   * exhausted and the job failed as a result. Optionally, a delay may also be
   * provided to implement backoff.
   *
   * Optional:
   *  - group (a string)
   *  - message (a string)
   *  - delay (a number)
   */
  retry(options) {
    options = options || {};
    const args = [
      'retry', this.jid, this.queueName, this.client.workerName, options.delay || 0,
    ];
    if (options.group && options.message) {
      args.push(options.group, options.message);
    }
    logger.info('Retrying job %s', this.jid);
    return this.client.call.apply(this.client, args);
  }

  depend() {
    return this.client.call.apply(
      this.client, ['depends', this.jid, 'on'].concat(Array.from(arguments)));
  }

  undepend() {
    return this.client.call.apply(
      this.client, ['depends', this.jid, 'off'].concat(Array.from(arguments)));
  }

  undependAll() {
    return this.undepend('all');
  }

  timeout() {
    logger.info('Timing out job %s', this.jid);
    return this.client.call('timeout', this.jid);
  }

}

module.exports = Job;
