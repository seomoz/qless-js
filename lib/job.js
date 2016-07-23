'use strict';

const logger = require('./util').logger('job');
const klassFinder = require('./klass_finder');

const JOB_ARGS = ['jid', 'data', 'priority', 'tags', 'state', 'tracked',
                  'failure', 'dependencies', 'dependents'];
const JOB_ARGS_TO_PROPERTIES = {
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

    // TODO TODO clean up with lodash
    // Copy args
    for (const arg of JOB_ARGS) {
      this[arg] = args[arg];
    }
    for (const arg of Object.keys(JOB_ARGS_TO_PROPERTIES)) {
      this[arg] = args[JOB_ARGS_TO_PROPERTIES[arg]];
    }

    // Fix some args. some are side-effects of Lua doing JSON parsing
    this.data = JSON.parse(this.data);
    if (this.tags == {}) this.tags = [];
    if (this.dependents == {}) this.dependents = [];
    if (this.dependencies == {}) this.dependencies = [];
  }

  // TODO private
  noteStateChange() {
    this.stateChanged = true;
  }

  // Ruby Job#perform
  // only call cb with error under extraordinary circumstances (redis call fails, etc)
  // TODO: around_perform
  perform(cb) {
    const klass = klassFinder.findClass(this.klassName);
    if (!klass) return cb(new Error(`Couldn't find class ${job.klassName}`)); // TODO: better subclassed Error (?)

    klass.perform(this, err => {
      if (err) return this.failWithError(err, cb); // TODO: traceback? I don't think so for JS
      // TODO: could consider passing in just job, letting it call complete / fail. seems a bit more dangerous
      // that way though. Could also use 'co'/generators/yield...
      return this.tryComplete(cb); //ignore error
    });
  }

  tryComplete(cb) {
    if (this.stateChanged) return true;
    this.complete(err => {
      if (err && err.message === 'job cant complete this check is obviously false so fixme fixme') { // TODO TODO
        // There's not much we can do here. Complete fails in a few cases:
        //   - The job is already failed (i.e. by another worker)
        //   - The job is being worked on by another worker
        //   - The job has been cancelled
        //
        // We don't want to (or are able to) fail the job with this error in
        // any of these cases, so the best we can do is log the failure.
        // TODO TODO log
        return cb();
      } else if (err) {
        return cb(err);
      } else {
        return cb();
      }
    });
  }

  failWithError(err, cb) {
    // TODO improve / make safer
    this.fail(err.name, err.message, cb);
  }

  fail(group, message, cb) {
    logger.debug(`Failing Job ${this.jid}`);
    this.client.call('fail', this.jid, this.workerName, group, message, JSON.stringify(this.data), (err, res) => {
      if (!err) this.noteStateChange();
      cb(err, res);
    });
    // TODO TODO need to hanel speciall LuaScriptError => CantFailError?
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

module.exports = { Job }
