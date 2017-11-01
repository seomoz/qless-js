'use strict';

const Promise = require('bluebird').Promise;
const expect = require('expect.js');
const sinon = require('sinon');

const helper = require('../helper.js');
const Job = require('../../lib/job.js');
const Client = require('../../lib/client.js');
const Worker = require('../../lib/workers/single.js');

describe('Single Worker', () => {
  const interval = 100;
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');
  let worker = null;

  beforeEach(() => {
    worker = new Worker(client, {
      queues: [queue],
      interval,
    });
    return cleaner.before();
  });

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('uses default interval', () => {
    expect(new Worker(client, {}).interval).to.eql(60000);
  });

  it('can run jobs', () => {
    const klass = {
      queue: job => job.complete().then(() => worker.stop()),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'Klass' })
        .then(jid => worker.run().then(() => client.job(jid)))
        .then(job => expect(job.state).to.eql('complete'));
    });
  });
});
