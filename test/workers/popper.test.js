'use strict';

const Promise = require('bluebird').Promise;
const expect = require('expect.js');

const Popper = require('../../lib/workers/popper.js');
const helper = require('../helper.js');
const Client = require('../../lib/client.js');

describe('Popper', () => {
  const interval = 100;
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queueA = client.queue('queueA');
  const queueB = client.queue('queueB');
  let popper = null;

  beforeEach(() => {
    popper = new Popper(client, [queueA, queueB]);
    return cleaner.before();
  });

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('can be stopped', () => {
    const delay = 2.5 * interval;
    const delayedStop = Promise.delay(delay).then(() => popper.stop());
    return Promise.all([delayedStop, popper.pop()])
      .spread((stop, job) => {
        expect(job).to.eql(null);
      });
  });

  describe('pop', () => {
    it('can pop a job', () => {
      const config = { klass: 'Klass', jid: 'jid' };
      return queueB.put(config)
        .then(() => popper.pop())
        .then(job => expect(job.jid).to.eql('jid'));
    });

    it('gives null if stopped', () => {
      popper.stop();
      return popper.pop()
        .then(job => expect(job).to.eql(null));
    });

    it('has no delay if found a job in round robin', () => {
      const start = (new Date()).getTime();
      return queueB.put({ klass: 'Klass', jid: 'one' })
        .then(() => queueB.put({ klass: 'Klass', jid: 'two' }))
        .then(() => popper.pop())
        .then(() => popper.pop())
        .then(() => {
          const now = (new Date()).getTime();
          expect(now - start).to.be.lessThan(interval);
        });
    });

    // eslint-disable-next-line arrow-body-style
    it('finds jobs in round-robin order', () => {
      const promises = [
        queueA.put({ klass: 'Klass', jid: 'one', priority: -1 }),
        queueB.put({ klass: 'Klass', jid: 'two', priority: -2 }),
        queueA.put({ klass: 'Klass', jid: 'three', priority: -3 }),
        queueB.put({ klass: 'Klass', jid: 'four', priority: -4 }),
      ];
      return Promise.all(promises)
        .then(() => popper.pop())
        .then((job) => {
          expect(job.jid).to.eql('one');
          return popper.pop();
        })
        .then((job) => {
          expect(job.jid).to.eql('two');
          return popper.pop();
        })
        .then((job) => {
          expect(job.jid).to.eql('three');
          return popper.pop();
        })
        .then((job) => {
          expect(job.jid).to.eql('four');
        });
    });
  });

  describe('popNext', () => {
    it('waits until a job is available', () => {
      const delay = 2.5 * interval;
      const delayedPut = Promise.delay(delay).then(() => queueB.put({ klass: 'Klass' }));

      const start = (new Date()).getTime();
      return Promise.all([delayedPut, popper.popNext(interval)])
        .spread((jid, job) => {
          expect(job.jid).to.eql(jid);
          const now = (new Date()).getTime();
          expect(now - start).to.be.greaterThan(delay);
        });
    });

    it('gives null if stopped', () => {
      popper.stop();
      return popper.popNext(interval)
        .then(job => expect(job).to.eql(null));
    });
  });
});
