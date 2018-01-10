'use strict';

const workerpool = require('workerpool');
const Worker = require('./multi.js');

const work = (config) => {
  const worker = new Worker(config);

  // This is necessary to ensure that when the parent process dies, that the
  // child processes in turn die as well
  process.on('disconnect', () => process.exit(0));

  process.on('SIGQUIT', () => worker.stop());

  return worker.run();
};

workerpool.worker({
  work,
});
