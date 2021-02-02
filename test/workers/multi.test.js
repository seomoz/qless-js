'use strict';

const fs = require('fs');
const os = require('os');
const Path = require('path');

const Promise = require('bluebird').Promise;
const expect = require('expect.js');
const sinon = require('sinon');

const helper = require('../helper.js');
const { Job } = require('../../lib/job.js');
const Client = require('../../lib/client.js');
const Worker = require('../../lib/workers/multi.js');

describe('Multi Worker', () => {
  const interval = 100;
  const capacity = 10;
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');
  const tmpdir = process.env.TMPDIR;
  let worker = null;

  beforeEach(() => {
    worker = new Worker({
      client,
      queues: [queue],
      interval,
      count: capacity,
      workdir: Path.join(os.tmpdir(), 'qless'),
    });

    return cleaner.before();
  });

  afterEach(() => {
    process.env.TMPDIR = tmpdir;
  });

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('uses default interval', () => {
    worker = new Worker({
      client,
      count: capacity,
      queueNames: ['queue'],
    });
    expect(worker.interval).to.eql(60000);
  });

  it('can accept a client config', () => {
    worker = new Worker({
      clientConfig: {
        url,
      },
      count: capacity,
      queueNames: [],
    });
    worker.client.quit();
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

  it('can set tmpdir', () => {
    worker.setTmpdir = true;

    const klass = {
      queue: job => job.complete().then(() => worker.stop()),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'Klass', jid: 'jid' })
        .then(() => worker.run())
        .then(() => expect(process.env.TMPDIR).to.eql(worker.workdir));
    });
  });

  it('creates and cleans up the job workdir', () => {
    const klass = {
      queue: job => {
        if (fs.existsSync(job.workdir)) {
          return job.complete().then(() => worker.stop());
        } else {
          return job.fail('queue-Error', 'directory did not exist').then(() => worker.stop());
        }
      },
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'Klass', jid: 'jid' })
        .then(() => worker.run())
        .then(() => client.job('jid'))
        .then(job => expect(job.state).to.eql('complete'));
    }).then(() => {
      return expect(fs.existsSync(Path.join(worker.workdir, 'jid'))).to.be(false);
    });
  });

  it('remains saturated with max-concurrency', () => {
    // This test will put several jobs in the queue and
    const jids = ['one', 'two', 'three', 'four', 'five'];
    let count = jids.length;
    const klass = {
      queue: job => Promise.delay(1)
        .then(() => job.complete())
        .then(() => {
          count -= 1;
          if (count === 0) {
            worker.stop();
          }
        }),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      const before = Date.now();

      return Promise.map(jids, jid => queue.put({ klass: 'Klass', jid }))
        .then(() => client.setConfig('queue-max-concurrency', 1))
        .then(() => worker.run())
        .then(() => Date.now() - before)
        .then(diff => expect(diff).to.be.lessThan(interval));
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
