#! /usr/bin/env node

const fs = require('fs');

const dumps = require('json-stable-stringify');
const Promise = require('bluebird');
const commander = require('commander');

const qless = require('../index.js');

const Client = qless.Client;
const logger = qless.logger;

// Make fs all promisified
Promise.promisifyAll(fs);

/**
 * Produce a stably-sorted, pretty string representation of an object.
 */
const stringify = data => dumps(data, {
  space: 2,
});

/**
 * Accumulate flags
 */
const collect = (val, memo) => {
  if (memo === undefined) {
    memo = [];
  }
  memo.push(val);
  return memo;
};

/**
 * Create and use a client, logging whatever the promise returned by fun resolves with
 */
const logWithClient = (options, func) => {
  const conf = {
    url: options.redis,
  };

  Client.using(conf, client => func(client)
    .then(stringify)
    .then(console.log)
    .catch(logger.error));
};

/**
 * Print out information about the provided queue
 */
const queue = (name, options) => {
  logWithClient(options.parent, client => client.queue(name).counts());
};

/**
 * Put a job
 */
const put = (name, options) => {
  logWithClient(options.parent, client => client.queue(name).put(options));
};

/**
 * Pause the provided queues
 */
const pause = (names, options) => {
  logWithClient(options.parent, (client) => {
    return Promise.map(names, name => client.queue(name).pause().thenReturn(name));
  });
};

/**
 * Unpause the provided queues
 */
const unpause = (names, options) => {
  logWithClient(options.parent, (client) => {
    return Promise.map(names, name => client.queue(name).unpause().thenReturn(name));
  });
};

/**
 * Print either the counts of each failure group or the jobs failed in a group
 */
const failures = (type, options) => {
  logWithClient(options.parent, client => client.jobs.failed(type));
};

/**
 * Retry all the jobs in the provided failure modes.
 */
const unfail = (types, options) => {
  logWithClient(options.parent, (client) => {
    const getFailedJobs = type => client.jobs
      .failed(type, options.offset, options.count)
      .get('jobs');

    return Promise.map(types, getFailedJobs)
      .then(arrays => arrays.reduce((a, b) => a.concat(b), []))
      .map(jid => client.job(jid), {
        concurrency: 1,
      })
      .map(jobObject => jobObject.move(jobObject.queueName), {
        concurrency: 1,
      });
  });
};

/**
 * Print information about a job
 */
const job = (jid, options) => {
  logWithClient(options.parent, client => client.job(jid)
    .then((jobObject) => {
      return jobObject
        ? jobObject.config
        : null;
    }));
};

/**
 * Cancel one or more jobs
 */
const cancel = (jids, options) => {
  logWithClient(options.parent, client => client.cancel.apply(client, jids));
};

/**
 * Show completed jobs
 */
const completed = (options) => {
  logWithClient(options.parent, client => client.jobs.complete(options.offset, options.count));
};

/**
 * Track the provided jobs
 */
const track = (jids, options) => {
  logWithClient(options.parent, client => client.track.apply(client, jids));
};

/**
 * Untrack the provided jobs
 */
const untrack = (jids, options) => {
  logWithClient(options.parent, client => client.untrack.apply(client, jids));
};

/**
 * Show all the tracked jids
 */
const tracked = (options) => {
  logWithClient(options.parent, client => client.jobs.tracked());
};

/**
 * Retry one or more jobs
 */
const retry = (jids, options) => {
  logWithClient(options, (client) => {
    const retryJob = jid => client.job(jid)
      .then((jobObject) => {
        if (jobObject) {
          return jobObject.move(jobObject.queueName);
        }
        logger.warn('Job %s does not exist', jid);
        return null;
      });

    return Promise.map(jids, retryJob, {
      concurrency: 1,
    });
  });
};

/**
 * Print the current config, or set the config values provided at path
 */
const config = (path, options) => {
  logWithClient(options.parent, (client) => {
    const setConfigs = (obj) => {
      const keys = Object.keys(obj);

      return Promise.map(keys, key => client.setConfig(key, obj[key]));
    };

    if (path) {
      return fs.readFileAsync(path)
        .then(JSON.parse)
        .then(setConfigs)
        .then(() => client.getConfig());
    }
    return client.getConfig();
  });
};

commander
  .option('-r, --redis <url>', 'The redis:// url to connect to')
  .option('-v, --verbose', 'Increase logging level', logger.increaseVerbosity);

commander
  .command('queue <name>')
  .description('Show the state of a particular queue')
  .action(queue);

commander
  .command('put <name>')
  .description('Put a job in the provided queue')
  .option('-j, --jid <jid>', 'Set the job id')
  .option('-k, --klass <klass>', 'Set the job class')
  .option('-d, --data <data>', 'Set the job data', JSON.parse)
  .option('-p, --priority <priority>', 'Set the job priority', parseInt)
  .option('-l, --delay <delay>', 'Delay the execution of the job by a number of seconds', parseInt)
  .option('-t, --tags <tag>', 'Add a tag to the job', collect)
  .option('-r, --retries <retries>', 'The number of retries to use for the job', parseInt)
  .option('-s, --depends <depends>', 'Add a job on which it depends', collect)
  .action(put);

commander
  .command('pause [names...]')
  .description('Pause the provided queues')
  .action(pause);

commander
  .command('unpause [names...]')
  .description('Unpause the provided queues')
  .action(unpause);

commander
  .command('failures [type]')
  .description('Show the counts for different types of failures, or list failed jobs')
  .action(failures);

commander
  .command('unfail [types...]')
  .description('Retry all the jobs of the provided failure modes')
  .option('-o, --offset <offset>', 'The offset for pagination of failed jobs', parseInt)
  .option('-c, --count <count>', 'The count for pagination of failed jobs', parseInt)
  .action(unfail);

commander
  .command('job <jid>')
  .description('Show the information for a particular job')
  .action(job);

commander
  .command('cancel [jids...]')
  .description('Cancel all the provided jobs')
  .action(cancel);

commander
  .command('completed')
  .description('Show completed jobs')
  .option('-o, --offset <offset>', 'The offset for pagination', parseInt)
  .option('-c, --count <count>', 'The count for pagination', parseInt)
  .action(completed);

commander
  .command('track [jids...]')
  .description('Track the provided jobs')
  .action(track);

commander
  .command('untrack [jids...]')
  .description('Untrack the provided jobs')
  .action(untrack);

commander
  .command('tracked')
  .description('Show all the tracked jobs')
  .action(tracked);

commander
  .command('retry [jids...]')
  .description('Retry all the provided jobs')
  .action(retry);

commander
  .command('config [path]')
  .description('Display the config, or set the config from the provided path')
  .action(config);

commander.parse(process.argv);
