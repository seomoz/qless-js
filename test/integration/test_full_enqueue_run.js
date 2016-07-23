'use strict';

require('../helpers');

describe('qless job integration test', () => {
  // TODO: redis flushing. choosing a redis number
  const client = new qless.Client();
  const queue = client.queue('my_test_queue');

  before(() => { qless.klassFinder.setModuleDir(__dirname + '/jobs') });

  beforeEach(cb => {
    // queue should be empty.
    queue.pop((err, job) => {
      expect(err).to.be.null;
      expect(job).to.be.null;
      cb();
    });
  });

  beforeEach(cb => {
    queue.put('MockJob', { key1: 'val1' }, {}, cb);
  });

  it('works when the job succeeds', done => {
    const worker = new qless.SerialWorker('my_test_queue', client);

    require('./jobs/MockJob').perform = (job, cb) => {
      job.data.should.eql({ key1: 'val1' });
      // TODO: test one is in "running" state

      // Set worker's run function to effectively check a couple
      // things and then shutdown the worker.
      worker.run = runCb => {
        // check queue should be empty
        queue.pop((err, job) => {
          expect(err).to.be.null;
          expect(job).to.be.null;
          // TODO TODO: check no running, stalled, or failed jobs
          done();
        });
      };

      cb(); // control will get back to run
    };

    worker.run(err => {
      console.log("ERROR IN WORKER: ", err);
      done(err);
    });
  });

});




