'use strict';

require('../helpers');

describe('qless job integration test', () => {
  const queue = qlessClient.queue('my_test_queue');

  before(() => {
    qless.klassFinder.setModuleDir(__dirname + '/jobs');
    bluebird.promisifyAll(queue);
    bluebird.promisifyAll(qlessClient.jobs);
  });

  beforeEach(function *() {
    expect(yield queue.popAsync()).to.be.null;
    yield queue.putAsync('MockJob', {key1: 'val1'}, {});

    expect(yield queue.runningAsync(null, null)).to.eql([]);
    expect(yield queue.scheduledAsync(null, null)).to.eql([]);
    expect(yield queue.stalledAsync(null, null)).to.eql([]);
    expect(yield qlessClient.jobs.failedCountsAsync()).to.eql({});
  });

  it('works when the job succeeds', done => {
    const worker = new qless.SerialWorker('my_test_queue', qlessClient);

    require('./jobs/MockJob').perform = (job, cb) => {
      job.data.should.eql({ key1: 'val1' });
      // TODO: test one is in "running" state


      // Set worker's run function to effectively check a couple
      // things and then shutdown the worker.
      worker.run = runCb => co(function *() {
        expect(yield queue.popAsync()).to.be.null;
        expect(yield queue.runningAsync(null, null)).to.eql([]);
        expect(yield queue.scheduledAsync(null, null)).to.eql([]);
        expect(yield queue.stalledAsync(null, null)).to.eql([]);
        expect(yield qlessClient.jobs.failedCountsAsync()).to.eql({});
      }).then(done, done);

      // Do some checks and give control back to "run".
      // Unless a check fails, then fail test with an error.
      co(function *() {
        expect(yield queue.popAsync()).to.be.null;
        expect(yield queue.runningAsync(null, null)).to.eql([job.jid]);
        expect(yield queue.scheduledAsync(null, null)).to.eql([]);
        expect(yield queue.stalledAsync(null, null)).to.eql([]);
        expect(yield qlessClient.jobs.failedCountsAsync()).to.eql({});
      }).then(val => cb(), err => { done(err) });
    };

    worker.run(err => {
      console.log("ERROR IN WORKER: ", err);
      done(err);
    });
  });

});




