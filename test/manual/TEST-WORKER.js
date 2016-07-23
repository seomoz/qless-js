'use strict';

process.env.DEBUG = '*'; // this may change in the future
const qless = require('../../qless');

qless.klassFinder.setModuleDir(__dirname + '/jobs');
const client = new qless.Client();
const worker = new qless.SerialWorker('myqueue', client);

worker.run(err => {
  console.log("ERROR IN WORKER: ", err);
});


