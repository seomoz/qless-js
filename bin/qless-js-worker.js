#! /usr/bin/env node

const assert = require('assert');
const os = require('os');
const qless = require('../index.js');

const commander = require('commander');

function collect(name, queues) {
  queues.push(name);
  return queues;
}

function increaseVerbosity(v, total) {
  return total + 1;
}

commander
  .option('-r, --redis <url>', 'The redis:// url to connect to')
  .option('-n, --name <name>', 'The name to identify your worker as', os.hostname())
  .option('-d, --workdir <dir>', 'The base work directory path')
  .option('-c, --concurrency <n>', 'The number of concurrent jobs to run [default 10]')
  .option('-p, --processes <n>', 'The number of processes to spawn [defaults to number of cores]', parseInt)
  .option('-i, --interval <n>', 'Polling interval in seconds [default 60]', parseFloat)
  .option('-q, --queue <name>', 'Add a queue to work on', collect, [])
  .option('-v, --verbose', 'Increase logging level', increaseVerbosity, 0)
  .option('-a, --allow-paths', 'Allow paths for job class names');

const options = commander.parse(process.argv);

if (options.verbose >= 2) {
  qless.logger.level = 'debug';
} else if (options.verbose === 1) {
  qless.logger.level = 'info';
}

assert(options.queue.length > 0, 'Must provide at least one queue');

options.processes = options.processes || os.cpus().length;

const config = {
  clientConfig: {
    url: options.redis,
    hostname: options.name,
  },
  queueNames: options.queue,
  interval: (options.interval || 60) * 1000,
  count: options.concurrency || 10,
  processConfig: {
    allowPaths: options.allowPaths,
  },
  processes: options.processes,
  logLevel: qless.logger.level,
};

const worker = options.processes === 1
  ? new qless.workers.Multi(config)
  : new qless.workers.Forking(config);

process.on('SIGQUIT', () => worker.stop());
process.on('SIGTERM', () => worker.stop(true));

worker.run();
