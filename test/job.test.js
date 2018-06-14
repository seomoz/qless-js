'use strict';

const expect = require('expect.js');
const Path = require('path');
const Promise = require('bluebird').Promise;
const sinon = require('sinon');

const Job = require('../lib/job.js');
const helper = require('./helper.js');
const Client = require('../lib/client.js');

describe('Job', () => {
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');

  beforeEach(() => cleaner.before());

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('has attributes', () => {
    const config = {
      klass: 'Klass',
      data: {
        whiz: 'bang',
      },
      jid: 'jid',
      tags: ['tag'],
      retries: 3,
    };
    return queue.put(config)
      .then(jid => client.job(jid))
      .then((job) => {
        expect(job.klassName).to.eql(config.klass);
        expect(job.data).to.eql(config.data);
        expect(job.jid).to.eql(config.jid);
        expect(job.tags).to.eql(config.tags);
        expect(job.originalRetries).to.eql(config.retries);
      });
  });

  it('can import a file', () => {
    const path = Path.resolve(__dirname, '../lib/client.js');
    expect(Job.import(path)).to.eql(Client);
  });

  it('can import a class', () => {
    const path = Path.resolve(__dirname, '../lib/client.js/disposer');
    expect(Job.import(path)).to.eql(Client.disposer);
  });

  it('throws when importing a nonexistent file', () => {
    expect(() => Job.import('does-not-exist')).to.throwError();
  });

  it('throws when importing a nonexistent class', () => {
    const path = Path.resolve(__dirname, '../lib/client.js/DoesNotExist');
    expect(() => Job.import(path)).to.throwError();
  });

  it('throws when importing nonexistent attributes', () => {
    const path = Path.resolve(__dirname, '../lib/client.js/some/atts/do/not/exist');
    expect(() => Job.import(path)).to.throwError();
  });

  it('can access the class for a job', () => {
    const klass = {};
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'my/awesome/klass' })
        .then(() => queue.pop())
        .then(job => expect(job.getKlass()).to.be(klass));
    });
  });

  it('throws when using an absolute path to a klass', () => {
    return queue.put({ klass: '/my/awesome/klass' })
      .then(() => queue.pop())
      .then(job => expect(() => job.getKlass()).to.throwError());
  });

  it('throws when using an . path to a klass', () => {
    return queue.put({ klass: 'my/../../malicioius/path' })
      .then(() => queue.pop())
      .then(job => expect(() => job.getKlass()).to.throwError());
  });

  it('allows the import of a . path to a klass if configured to', () => {
    const path = Path.resolve(__dirname, '../lib/job.js');
    return queue.put({ klass: path })
      .then(() => queue.pop())
      .then(job => expect(job.getKlass({ allowPaths: true })).to.eql(Job));
  });

  it('can set priority', () => {
    const jid = 'jid';
    const priority = 10;
    return queue.put({ klass: 'Klass', priority: 0, jid })
      .then(() => client.job(jid))
      .then(job => job.setPriority(priority))
      .then(() => client.job(jid))
      .then(job => expect(job.priority).to.eql(priority));
  });

  it('can access a queue object', () => {
    return queue.put({ klass: 'Klass' })
      .then(jid => client.job(jid))
      .then(job => expect(job.getQueue().name).to.eql(queue.name));
  });

  it('exposes the TTL for a job', () => {
    return queue.setHeartbeat(10)
      .then(() => queue.put({ klass: 'Klass' }))
      .then(() => queue.pop())
      .then(job => expect(job.getTtl()).to.be.within(9.9, 10));
  });

  it('can cancel', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then(job => job.cancel())
      .then(() => client.job(jid))
      .then(job => expect(job).to.be(null));
  });

  it('can tag and untag', () => {
    const jid = 'jid';
    const tag = 'tag';
    return queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then(job => job.tag(tag))
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.tags).to.eql([tag]);
        return job.untag(tag);
      })
      .then(() => client.job(jid))
      .then(job => expect(job.tags).to.eql([]));
  });

  it('can move', () => {
    const jid = 'jid';
    const destination = 'destination';
    return queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then(job => job.move(destination))
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.queueName).to.eql(destination);
        expect(job.state).to.eql('waiting');
      });
  });

  it('can move with delay and depends', () => {
    const jid = 'jid';
    const destination = 'destination';
    return queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then(job => job.move(destination, { delay: 10, depends: ['nonexistent-jid'] }))
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.queueName).to.eql(destination);
        expect(job.state).to.eql('scheduled');
      });
  });

  it('can complete', () => {
    return queue.put({ klass: 'Klass' })
      .then(() => queue.pop())
      .tap(job => job.complete())
      .then(job => client.job(job.jid))
      .then(job => expect(job.state).to.eql('complete'));
  });

  it('can advance', () => {
    const next = 'next';
    return queue.put({ klass: 'Klass' })
    .then(() => queue.pop())
    .tap(job => job.complete(next))
    .then(job => client.job(job.jid))
    .then((job) => {
      expect(job.state).to.eql('waiting');
      expect(job.queueName).to.eql(next);
    });
  });

  it('can advance with delay and depends', () => {
    const next = 'next';
    return queue.put({ klass: 'Klass' })
      .then(() => queue.pop())
      .tap(job => job.complete('next', { delay: 10, depends: ['nonexistent-jid'] }))
      .then(job => client.job(job.jid))
      .then(job => expect(job.queueName).to.eql(next));
  });

  it('can heartbeat', () => {
    return queue.setHeartbeat(10)
      .then(() => queue.put({ klass: 'Klass' }))
      .then(() => queue.pop())
      .then((job) => {
        const expiration = job.expiresAt;
        return queue.setHeartbeat(20)
          .then(() => job.heartbeat())
          .then(() => expect(job.expiresAt).to.be.above(expiration));
      });
  });

  it('throws for failed heartbeats', (done) => {
    const jid = 'jid';
    queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then(job => job.heartbeat())
      .catch(() => done()); // TODO(dan): Assertion about the type of error here
  });

  it('can fail a job', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', jid })
      .then(() => queue.pop())
      .then(job => job.fail('group', 'message'))
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.failure.group).to.eql('group');
        expect(job.failure.message).to.eql('message');
      });
  });

  it('can track and untrack a job', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', jid })
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.tracked).to.be(false);
        return job.track().then(() => client.job(jid));
      })
      .then((job) => {
        expect(job.tracked).to.be(true);
        return job.untrack().then(() => client.job(jid));
      })
      .then(job => expect(job.tracked).to.be(false));
  });

  it('can depend and undepend', () => {
    return queue.put({ klass: 'Klass', jid: 'a' })
      .then(() => queue.put({ klass: 'Klass', jid: 'b' }))
      .then(() => queue.put({ klass: 'Klass', jid: 'c', depends: ['a'] }))
      .then(() => client.job('c'))
      .then((job) => {
        expect(job.dependencies).to.eql(['a']);
        return job.depend('b').then(() => client.job('c'));
      })
      .then((job) => {
        expect(job.dependencies).to.eql(['a', 'b']);
        return job.undepend('a').then(() => client.job('c'));
      })
      .then((job) => {
        expect(job.dependencies).to.eql(['b']);
        return job.undependAll().then(() => client.job('c'));
      })
      .then(job => expect(job.dependencies).to.eql([]));
  });

  it('throws for failed retry', (done) => {
    queue.put({ klass: 'Klass' })
      .then(jid => client.job(jid))
      .then(job => job.retry())
      .catch(() => done()); // TODO(dan): assertion about the type of error
  });

  it('can retry with a group and message', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', retries: 0, jid })
      .then(() => queue.pop())
      .then(job => job.retry({ group: 'group', message: 'message' }))
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.failure.group).to.eql('group');
        expect(job.failure.message).to.eql('message');
      });
  });

  it('can retry without a group and message', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', retries: 5, jid })
      .then(() => queue.pop())
      .then(job => job.retry())
      .then(() => client.job(jid))
      .then(job => expect(job.retriesLeft).to.eql(4));
  });

  it('can timeout a job', () => {
    const jid = 'jid';
    return queue.put({ klass: 'Klass', jid })
      .then(() => queue.pop())
      .then((job) => {
        expect(job.state).to.eql('running');
        return job.timeout();
      })
      .then(() => client.job(jid))
      .then(job => expect(job.state).to.eql('stalled'));
  });

  it('can run a klass queue namesake function', () => {
    const jid = 'jid';
    const klass = {
      queue: job => job.complete(),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'my/awesome/klass', jid })
        .then(() => queue.pop())
        .then(job => job.process())
        .then(() => client.job(jid))
        .then(job => expect(job.state).to.eql('complete'));
    });
  });

  it('can run a klass process function', () => {
    const jid = 'jid';
    const klass = {
      process: job => job.complete(),
    };
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'my/awesome/klass', jid })
        .then(() => queue.pop())
        .then(job => job.process())
        .then(() => client.job(jid))
        .then(job => expect(job.state).to.eql('complete'));
    });
  });

  it('does not blow up if failing the job fails', () => {
    const jid = 'jid';
    const klass = {
      process: () => {
        throw new Error('Kaboom');
      },
    };

    // Set up a stub for import to provide the above class
    const importDisposer = helper.stubDisposer(Job, 'import', () => klass);
    return Promise.using(importDisposer, () => {
      // Run this job that's destined to fail, ensure that `job.process` does not reject
      return queue.put({ klass: 'my/awesome/klass', jid })
        .then(() => queue.pop())
        .then((job) => {
          // Set up a stub to have job.fail fail
          const failDisposer = helper.stubDisposer(job, 'fail', () => {
            return Promise.reject(new Error('Failed to fail'));
          });

          return Promise.using(failDisposer, () => job.process());
        })
        .then(() => client.job(jid))
        .then(job => expect(job.state).to.eql('running'));
    });
  });

  it('fails a job if it can find no method', () => {
    const jid = 'jid';
    const klass = {};
    const disposer = helper.stubDisposer(Job, 'import', sinon.stub());
    return Promise.using(disposer, (stub) => {
      stub.returns(klass);
      return queue.put({ klass: 'my/awesome/klass', jid })
        .then(() => queue.pop())
        .then(job => job.process())
        .then(() => client.job(jid))
        .then((job) => {
          expect(job.state).to.eql('failed');
          expect(job.failure.group).to.eql('queue-Error');
        });
    });
  });

  it('fails when it cannot import a job', () => {
    const jid = 'jid';
    return queue.put({ klass: 'my/awesome/klass', jid })
      .then(() => queue.pop())
      .then(job => job.process())
      .then(() => client.job(jid))
      .then((job) => {
        expect(job.state).to.eql('failed');
        expect(job.failure.group).to.eql('queue-Error');
      });
  });

  describe('heartbeatUntilPromise', () => {
    const heartbeat = 2;
    const delay = 3.5;
    const padding = 1;

    it('can heartbeat until a promise resolves', () => {
      return queue.setHeartbeat(heartbeat)
        .then(() => queue.put({ klass: 'Klass' }))
        .then(() => queue.pop())
        .then((job) => {
          const promise = Promise.delay(delay * 1000).then(() => job.complete());
          return job.heartbeatUntilPromise(promise, padding).return(job);
        })
        .then(job => client.job(job.jid))
        .then(job => expect(job.state).to.eql('complete'));
    });

    it('can heartbeat until a promise rejects', (done) => {
      return queue.setHeartbeat(heartbeat)
        .then(() => queue.put({ klass: 'Klass' }))
        .then(() => queue.pop())
        .then((job) => {
          const promise = Promise.delay(delay * 1000).then(() => Promise.reject(Error('kaboom')));
          return job.heartbeatUntilPromise(promise, padding).return(job);
        })
        .catch(() => done()); // TODO(dan): Assertion about the type of error here
    });

    it('returns quickly if the provided promise does', () => {
      return queue.put({ klass: 'Klass' })
        .then(() => queue.pop())
        .then(job => job.heartbeatUntilPromise(job.complete()));
    });
  });

  describe('spawnedFromJid', () => {
    it('is null if not spawned from recurring', () => {
      return queue.put({ klass: 'Klass' })
        .then(() => queue.pop())
        .then(job => expect(job.spawnedFromJid).to.eql(null));
    });

    it('is the recurring job ID if spawned from recurring', () => {
      return queue.recur({ jid: 'jid', klass: 'Klass', interval: 10 })
        .then(() => queue.pop())
        .then(job => expect(job.spawnedFromJid).to.eql('jid'));
    });
  });
});
