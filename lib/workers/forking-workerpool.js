'use strict';

const workerpool = require('workerpool');
const Worker = require('./multi.js');
const logger = require('../logger.js');
const { Job } = require('../job.js');
const Client = require('../client.js');

const work = (config) => {
  if (config.logLevel !== undefined) {
    logger.level = config.logLevel;
  }

  const worker = new Worker(config);

  // This is necessary to ensure that when the parent process dies, that the
  // child processes in turn die as well
  process.on('disconnect', () => process.exit(0));

  process.on('SIGQUIT', () => worker.stop());

  return worker.run();
};

const fork = (config = {}, jobConfig = {}) => {
  const client = new Client(config);
  const job = new Job(client, jobConfig);

  job.disableFork();

  return job.process({
    allowPaths: true,
  });
};

workerpool.worker({
  work,
  fork,
});
