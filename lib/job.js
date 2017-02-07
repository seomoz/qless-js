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

const JOB_ARGS_TO_PROPERTIES = {
  jid: 'jid',
  data: 'data',
  priority: 'priority',
  tags: 'tags',
  state: 'state',
  tracked: 'tracked',
  failure: 'failure',
  dependencies: 'dependencies',
  dependents: 'dependents',
  spawnedFromJid: 'spawned_from_jid',
  expiresAt: 'expires',
  klassName: 'klass',
  queueName: 'queue',
  workerName: 'worker',
  originalRetries: 'retries',
  retriesLeft: 'remaining',
  rawQueueHistory: 'history',
};


// TODO: split up into BaseJob and RecurringJob
class Job {
  constructor(client, args) {
    this.client = client;
    this._stateChanged = false;

    // Copy args
    Object.assign(this, _.mapValues(JOB_ARGS_TO_PROPERTIES, key => args[key]));

    // Some properties need extra parsing / fixing
    this.data = JSON.parse(this.data);
    // Side effect of Lua doing JSON parsing -- Lua empty array is {}
    if (_.isEmpty(this.tags)) this.tags = [];
    if (_.isEmpty(this.dependents)) this.dependents = [];
    if (_.isEmpty(this.dependencies)) this.dependencies = [];
  }

  // If the job has been fail()ed, complete()d, etc. since object creation
  isStateChanged() {
    return this._stateChanged;
  }

  getKlass() {
    return klassFinder.findClass(this.klassName);
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

  toString() {
    return `<qless.Job ${this.klassName} (${this.jid} / ${this.queueName} / ${this.state} / ${JSON.stringify(this.data)})>`;
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
    logger.info(`Completing Job ${this.jid}`);
    this.client.call('complete', this.jid, this.workerName, this.queueName, JSON.stringify(this.data), (err, res) => {
      if (!err) this._noteStateChange();
      cb(err, res);
    });
  }

  track(cb) {
    logger.info(`Tracking Job ${this.jid}`);
    this.client.call('track', 'track', this.jid, (err, res) => {
      cb(err, res);
    });
  }
  
  untrack(cb) {
    logger.info(`Untracking Job ${this.jid}`);
    this.client.call('track', 'untrack', this.jid, (err, res) => {
      cb(err, res);
    });
  }
  
  // private
  _noteStateChange() {
    this._stateChanged = true;
  }
}

module.exports = { Job };
