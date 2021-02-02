#! /usr/bin/env node

const os = require('os');
const Path = require('path');

const assert = require('assert');
const bytes = require('bytes');
const qless = require('../index.js');

const commander = require('commander');

function collect(name, queues) {
  queues.push(name);
  return queues;
}

function increaseVerbosity(v, total) {
  return total + 1;
}

// The maximum memory configuration allows us to deal with processes that may
// have memory leaks that have not been tracked down. In the forking worker mode
// it will terminate any child process that exceeds this limit, replacing it
// with a new worker. In the single worker mode, it has no effect. The maximum
// memory configuration can be provided in a number of ways:
//    - Percentage - when provided as a percentage, it takes the total amount of
//      memory available on the machine, divides by the number of forked
//      processes, and then multiplies by the provided percentage. For example,
//      if a machine has 10GB of RAM, and we use 10 processes, with this value
//      set to 70%, then each child process would be capped at 10GB * 0.7 / 10
//      or 700MB. There is nothing preventing this percentage from exceeding
//      100%; in such a case, then while not _all_ child processes could use
//      that much memory, a few would be able to.
//    - Absolute - when provided as an absolute value (like 100MB or 1.7GB),
//      then that limit is used directly.

commander
  .option('-r, --redis <url>', 'The redis:// url to connect to')
  .option('-n, --name <name>', 'The name to identify your worker as', os.hostname())
  .option('-d, --workdir <dir>', 'The base work directory path')
  .option('-c, --concurrency <n>', 'The number of concurrent jobs to run [default 10]')
  .option('-p, --processes <n>', 'The number of processes to spawn [defaults to number of cores]', parseInt)
  .option('-i, --interval <n>', 'Polling interval in seconds [default 60]', parseFloat)
  .option('-q, --queue <name>', 'Add a queue to work on', collect, [])
  .option('-v, --verbose', 'Increase logging level', increaseVerbosity, 0)
  .option('-a, --allow-paths', 'Allow paths for job class names')
  .option('-m, --max-memory <max>', 'Maximum memory each process can consume', 'Infinity')
  .option('-t, --set-tmpdir', 'Set tmpdir to be qless worker process workdir');

const options = commander.parse(process.argv);

if (options.verbose >= 2) {
  qless.logger.level = 'debug';
} else if (options.verbose === 1) {
  qless.logger.level = 'info';
}

assert(options.queue.length > 0, 'Must provide at least one queue');

options.processes = options.processes || os.cpus().length;

const getMaxMemory = () => {
  if (options.maxMemory.includes('%')) {
    const percentage = parseFloat(options.maxMemory.replace('%', ''));
    const available = os.totalmem();
    return (available * percentage * 0.01) / (options.processes);
  } else {
    return parseFloat(bytes.parse(options.maxMemory));
  }
};

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
  workdir: options.workdir || Path.join(os.tmpdir(), 'qless'),
  processes: options.processes,
  logLevel: qless.logger.level,
  memory: {
    interval: 60000,
    max: getMaxMemory(),
  },
  setTmpdir: options.setTmpdir,
};

const worker = options.processes === 1
  ? new qless.workers.Multi(config)
  : new qless.workers.Forking(config);

process.on('SIGQUIT', () => worker.stop());
process.on('SIGTERM', () => worker.stop(true));

worker.run();
