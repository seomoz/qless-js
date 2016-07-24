'use strict';

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
    this.stateChanged = false;

    // Copy args
    Object.assign(this, _.mapValues(JOB_ARGS_TO_PROPERTIES, key => args[key]));

    // Fix some args
    this.data = JSON.parse(this.data);
    // Side effect of Lua doing JSON parsing -- Lua empty array is {}
    if (_.isEmpty(this.tags)) this.tags = [];
    if (_.isEmpty(this.dependents)) this.dependents = [];
    if (_.isEmpty(this.dependencies)) this.dependencies = [];
  }

  // TODO private
  noteStateChange() {
    this.stateChanged = true;
  }

  // If the job has been fail()ed, complete()d, etc. since object creation
  isStateChanged() {
    return this.stateChanged;
  }

  // Ruby Job#perform
  // cb is called with error if the job fails
  // TODO: around_perform
  perform(cb) {
    const klass = klassFinder.findClass(this.klassName);
    if (!klass) return cb(new errors.ClassNotFound(this.klassName));
    klass.perform(cb);
  }

  failWithError(err, cb) {
    if (err instanceof Error) {
      this.fail(err.name, `${err.message}\n\n${err.stack}`, cb);
    } else {
      this.fail(err.toString(), err.toString(), cb);
    }
  }

  fail(group, message, cb) {
    logger.debug(`Failing Job ${this.jid}`);
    this.client.call('fail', this.jid, this.workerName, group, message, JSON.stringify(this.data), (err, res) => {
      // TODO TODO: catch Job::CantFailError
      if (!err) this.noteStateChange();
      cb(err, res);
    });
  }

  // TODO support "nextq"
  // TODO TODO why "or false" here & in fail in python & ruby?
  complete(cb) {
    logger.debug(`Completing Job ${this.jid}`);
    this.client.call('complete', this.jid, this.workerName, this.queueName, JSON.stringify(this.data), (err, res) => {
      if (!err) this.noteStateChange();
      cb(err, res);
    });
  }

}

module.exports = { Job };
