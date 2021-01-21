'use strict';

const os = require('os');
const Path = require('path');

const Promise = require('bluebird').Promise;
const expect = require('expect.js');

const helper = require('../helper.js');
const Client = require('../../lib/client.js');
const Worker = require('../../lib/workers/forking.js');

describe('Forking Worker', () => {
  const interval = 100;
  const capacity = 10;
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');
  let worker = null;

  beforeEach(() => {
    worker = new Worker({
      clientConfig: {
        url,
      },
      queueNames: ['queue'],
      processConfig: {
        allowPaths: true,
      },
      interval,
      count: capacity,
      processes: 2,
      workdir: Path.join(os.tmpdir(), 'qless'),
      memory: {
        max: Infinity,
        interval: 1000,
      },
    });
    return cleaner.before();
  });

  afterEach(() => cleaner.after());

  afterEach(() => worker.stop(true));

  afterAll(() => client.quit());

  it('can run jobs', () => {
    const klass = Path.resolve(__dirname, '../jobs/workers/BasicJob');
    const jid = 'jid';

    return queue.put({ klass, jid })
      .then(() => {
        const poll = () => {
          return client.job(jid)
            .then((job) => {
              if (job.state === 'failed' || job.state === 'complete') {
                worker.stop();
                return job.state;
              }
              return Promise.delay(1000).then(poll);
            });
        };

        return Promise.all([poll(), worker.run()]);
      })
      .spread(state => expect(state).to.eql('complete'));
  });

  it('can forcefully quit workers', () => {
    return Promise.all([
      worker.run(),
      Promise.delay(50).then(() => worker.stop(true)),
    ]);
  });

  it('can quit workers that consume too much memory', async () => {
    worker.memory.max = 0;
    const promise = worker.run();

    while (worker.pool.workers.length < worker.config.processes) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.delay(50);
    }
    const mocks = worker.pool.workers.map((child) => jest.spyOn(child.worker, 'kill'));

    await Promise.delay(worker.memory.interval * 2);
    for (const mock of mocks) {
      expect(mock.mock.calls.length).to.be.greaterThan(0);
    }

    worker.stop(true);

    return promise;
  });

  it('does not quit workers that consume acceptable memory', async () => {
    const promise = worker.run();

    while (worker.pool.workers.length < worker.config.processes) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.delay(50);
    }
    const mocks = worker.pool.workers.map((child) => jest.spyOn(child.worker, 'kill'));

    await Promise.delay(worker.memory.interval * 2);
    for (const mock of mocks) {
      expect(mock.mock.calls.length).to.be.equal(0);
    }

    worker.stop(true);

    await promise;
  });

  it('respawns workers that die', () => {
    const getPids = () => worker.pool.workers.map(poolWorker => poolWorker.worker.pid);
    const busyWaitPid = (pid) => {
      try {
        // Killing a process with signal 0 is a way to check if a process exists
        return Promise.resolve(process.kill(pid, 0))
          .delay(100)
          .then(() => busyWaitPid(pid));
      } catch (err) {
        return Promise.resolve(pid);
      }
    };
    const checkRespawn = () => {
      const original = getPids();

      // Destroy all the worker processes
      original.forEach((pid) => {
        process.kill(pid);
      });

      // Wait for the worker processes to be killed and then check what the
      // replacement pids are
      return Promise.map(original, busyWaitPid)
        .then(() => {
          const replacements = getPids();

          expect(replacements.length).to.eql(original.length);
          expect(replacements).not.to.eql(original);
        })
        .then(() => worker.stop());
    };

    return Promise.all([worker.run(), checkRespawn()]);
  });
});
