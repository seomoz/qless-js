'use strict';

/**
 * The Job class encapsulates the properties of a qless job being worked
 * on by a particular worker (our worker) and allows us to cancel the job,
 * fail the job, etc.
 */

const logger = require('./util').logger('job');
const klassFinder = require('./klass_finder');
const errors = require('./errors');
const _ = require('lodash');

const BASE_ARGS_TO_PROPERTIES = {
  data: 'data',
  jid: 'jid',
  klassName: 'klass',
  priority: 'priority',
  queueName: 'queue',
  retries: 'retries',
  tags: 'tags',
  workerName: 'worker',
};

const JOB_ARGS_TO_PROPERTIES = {
  dependencies: 'dependencies',
  dependents: 'dependents',
  expiresAt: 'expires',
  failure: 'failure',
  state: 'state',
  tracked: 'tracked',
  originalRetries: 'retries',
  retriesLeft: 'remaining',
  rawQueueHistory: 'history',
  spawnedFromJid: 'spawned_from_jid',
};

const RECUR_ARGS_TO_PROPERTIES = {
  count: 'count',
  interval: 'interval',
  originalRetries: 'retries',
};


class BaseJob {
  constructor(client, args) {
    this.client = client;
    this._stateChanged = false;

    // Copy args
    Object.assign(this, _.mapValues(BASE_ARGS_TO_PROPERTIES, key => args[key]));

    // Some properties need extra parsing / fixing
    this.data = JSON.parse(this.data);
    // Side effect of Lua doing JSON parsing -- Lua empty array is {}
    if (_.isEmpty(this.tags)) this.tags = [];
  }

  // If the job has been fail()ed, complete()d, etc. since object creation
  isStateChanged() {
    return this._stateChanged;
  }

  getKlass() {
    return klassFinder.findClass(this.klassName);
  }

  toString() {
    return `<qless.Job ${this.klassName} (${this.jid} / ${this.queueName} / ${this.state} / ${JSON.stringify(this.data)})>`;
  }

  // private
  _noteStateChange() {
    this._stateChanged = true;
  }
}


class Job extends BaseJob {

  constructor(client, args) {
    super(client, args);

    // Copy args
    Object.assign(this, _.mapValues(JOB_ARGS_TO_PROPERTIES, key => args[key]));

    // Side effect of Lua doing JSON parsing -- Lua empty array is {}
    if (_.isEmpty(this.dependents)) this.dependents = [];
    if (_.isEmpty(this.dependencies)) this.dependencies = [];
  }

  get ttl() {
    // How long until this expires, in seconds
    return this.expiresAt - ((new Date).getTime() / 1000);
  }

  setPriority(val, cb) {
    this.client.call('priority', this.jid, val, (err, res) => {
      if (!err) this._noteStateChange();
      this.priority = val;

      cb(err, res);
    });
  }

  // Equivalent to qless-ruby's Job#perform -- runs job
  // and passes any errors from job up to called.
  // cb is called with error if the job fails. (Note that
  // this is different from qless-py's Job#process)
  // TODO: around_perform
  perform(cb) {
    const klass = this.getKlass();
    if (!klass) return cb(new errors.CouldntLoadClass(this.klassName));
    if (typeof(klass.perform) !== 'function') return cb(new errors.ClassLackingPerformMethod(this.klassName));
    klass.perform(this, cb);
  }

  /**
   * May fail with errors.LuaScriptError if job is unfailable.
   */
  fail(group, message, cb) {
    logger.info(`Failing Job ${this.jid}`);
    this.client.call('fail', this.jid, this.workerName, group, message, JSON.stringify(this.data), (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  // TODO support "nextq"
  /**
   * May fail with errors.LuaScriptError if job is uncompleteable (already been failed, being worked on by another worker, etc.)
   */
  complete(cb) {
    this.client.call('complete', this.jid, this.workerName, this.queueName, JSON.stringify(this.data), (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  cancel(cb) {
    this.client.call('cancel', this.jid, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  /**
   * May fail with errors.LuaScriptError if job is uncompleteable (already been failed, being worked on by another worker, etc.)
   */
  heartbeat(cb) {
    this.client.call('heartbeat', this.jid, this.workerName, (err, res) => {
      if (!err) this._noteStateChange();
      this.expiresAt = res;
      cb(err, res);
    });
  }

  track(cb) {
    this.client.call('track', 'track', this.jid, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  untrack(cb) {
    this.client.call('track', 'untrack', this.jid, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  tag(tag, cb) {
    this.client.call('tag', 'add', this.jid, tag, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  untag(tag, cb) {
    this.client.call('tag', 'remove', this.jid, tag, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  /**
   * May fail with errors.LuaScriptError if job is uncompleteable (already been failed, being worked on by another worker, etc.)
   */
  retry(cb, group, message, delay) {
    // default values not supported in all node v4
    if (delay === undefined) {
      delay = 0;
    }

    logger.info(`Retrying job ${this.jid} in ${delay} seconds`);
    this.client.call('retry', this.jid, this.queueName, this.workerName, delay, group, message, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  /**
   * May fail with errors.LuaScriptError if job is not running
   */
  timeout(cb) {
    this.client.call('timeout', this.jid, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  move(queue, cb, delay) {
    // default values not supported in all node v4
    if (delay === undefined) {
      delay = 0;
    }

    this.client.call('put', this.workerName, queue, this.jid, this.klassName, JSON.stringify(this.data), delay, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }
}


class RecurringJob extends BaseJob {
  constructor(client, args) {
    super(client, args);

    // Copy args
    Object.assign(this, _.mapValues(RECUR_ARGS_TO_PROPERTIES, key => args[key]));
  }

  setPriority(priority, cb) {
    this.client.call('recur.update', this.jid, 'priority', priority, (err, res) => {
      if (!err) this._noteStateChange();
      this.priority = priority;
      cb(err, res);
    });
  }

  setRetries(retries, cb) {
    this.client.call('recur.update', this.jid, 'retries', retries, (err, res) => {
      if (!err) this._noteStateChange();
      this.retries = retries;
      cb(err, res);
    });
  }

  setInterval(interval, cb) {
    this.client.call('recur.update', this.jid, 'interval', interval, (err, res) => {
      if (!err) this._noteStateChange();
      this.interval = interval;
      cb(err, res);
    });
  }

  setData(data, cb) {
    this.client.call('recur.update', this.jid, 'data', JSON.stringify(data), (err, res) => {
      if (!err) this._noteStateChange();
      this.data = data;
      cb(err, res);
    });
  }

  setKlass(klass, cb) {
    this.client.call('recur.update', this.jid, 'klass', klass, (err, res) => {
      if (!err) this._noteStateChange();
      this.klassName = klass;
      cb(err, res);
    });
  }

  cancel(cb) {
    this.client.call('unrecur', this.jid, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  tag(tag, cb) {
    this.client.call('recur.tag', this.jid, tag, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  untag(tag, cb) {
    this.client.call('recur.untag', this.jid, tag, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  update(cb) {
    this.client.call(
        'recur.update',
        this.jid,
        'klass', this.klassName,
        'queue', this.queueName,
        'data', JSON.stringify(this.data),
        'priority', this.priority,
        'interval', this.interval,
        'retries', this.retries,
        (err, res) => {
          if (!err) this._noteStateChange();
          cb(err, res);
        }
    );
  }

  move(queue, cb) {
    this.client.call('recur.update', this.jid, 'queue', queue, (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

}

module.exports = { Job, RecurringJob };
