'use strict';

const Promise = require('bluebird').Promise;
const expect = require('expect.js');
const sinon = require('sinon');

const helper = require('../helper.js');
const Job = require('../../lib/job.js');
const Client = require('../../lib/client.js');
const Worker = require('../../lib/workers/multi.js');

describe('Multi Worker', () => {
  const interval = 100;
  const capacity = 10;
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');
  let worker = null;

  beforeEach(() => {
    worker = new Worker(client, {
      queues: [queue],
      interval,
      count: capacity,
    });
    return cleaner.before();
  });

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('uses default interval', () => {
    worker = new Worker(client, { count: capacity });
    expect(worker.popper.interval).to.eql(60000);
  });

  it('can run jobs', () => {
    const klass = {
      queue: job => job.complete().then(() => worker.stop()),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'Klass', jid: 'jid' })
        .then(() => worker.run())
        .then(() => client.job('jid'))
        .then(job => expect(job.state).to.eql('complete'));
    });
  });

  it('runs multiple jobs concurrently', () => {
    const factor = 3;
    const delay = 1000;
    let remaining = capacity * factor;

    const klass = {
      queue: (job) => {
        return Promise
          .try(() => {
            remaining -= 1;
            return remaining;
          })
          .delay(delay)
          .then(() => job.complete())
          .then(() => {
            if (!remaining) {
              worker.stop();
            }
          });
      },
    };

    const puts = [];
    for (let i = 0; i < remaining; i += 1) {
      puts.push(queue.put({ klass: 'Klass' }));
    }

    const start = (new Date().getTime());
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return Promise.all(puts)
        .then((jids) => {
          return worker.run()
            .then(() => {
              return Promise.all(jids.map((jid) => { return client.job(jid); }));
            })
            .then(jobs => jobs.map(job => expect(job.state).to.eql('complete')));
        })
        .then(() => {
          const now = (new Date().getTime());
          const delays = (now - start) / delay;
          expect(delays).to.be.within(factor, (factor + 1));
        });
    });
  });
});
