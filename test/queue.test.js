'use strict';

const expect = require('expect.js');
const Client = require('../lib/client.js');
const helper = require('./helper.js');

describe('Queue', () => {
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');

  beforeEach(() => cleaner.before());

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  describe('Jobs', () => {
    beforeEach(() => queue.put({ klass: 'Klass' }));

    it('provides access to depends jobs', () => {
      return queue.jobs.depends().then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to depends jobs with offset, count', () => {
      return queue.jobs.depends({
        offset: 5,
        count: 5,
      }).then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to running jobs', () => {
      return queue.jobs.running().then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to running jobs with offset, count', () => {
      return queue.jobs.running({
        offset: 5,
        count: 5,
      }).then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to stalled jobs', () => {
      return queue.jobs.stalled().then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to stalled jobs with offset, count', () => {
      return queue.jobs.stalled({
        offset: 5,
        count: 5,
      }).then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to scheduled jobs', () => {
      return queue.jobs.scheduled().then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to scheduled jobs with offset, count', () => {
      return queue.jobs.scheduled({
        offset: 5,
        count: 5,
      }).then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to recurring jobs', () => {
      return queue.jobs.recurring().then((response) => {
        expect(response).to.eql([]);
      });
    });

    it('provides access to recurring jobs with offset, count', () => {
      return queue.jobs.recurring({
        offset: 5,
        count: 5,
      }).then((response) => {
        expect(response).to.eql([]);
      });
    });
  });

  it('provides access to counts', () => {
    const expected = {
      depends: 0,
      name: 'queue',
      paused: false,
      recurring: 0,
      running: 0,
      scheduled: 0,
      stalled: 0,
      waiting: 1,
    };
    return queue.put({ klass: 'Klass' })
      .then(() => queue.counts())
      .then(counts => expect(counts).to.eql(expected));
  });

  it('can pause', () => {
    return queue.put({ klass: 'Klass' })
      .then(() => queue.pause())
      .then(() => queue.pop())
      .then((jobs) => {
        expect(jobs).to.eql(null);
        return queue.counts();
      })
      .then(counts => expect(counts.paused).to.be(true));
  });

  it('can unpause', () => {
    return queue.pause()
      .then(() => queue.unpause())
      .then(() => queue.counts())
      .then(counts => expect(counts.paused).to.be(false));
  });

  it('gets and sets heartbeat', () => {
    return queue.setHeartbeat(10)
      .then(() => queue.getHeartbeat())
      .then(heartbeat => expect(heartbeat).to.eql(10));
  });

  it('gets default hearteat', () => {
    return queue.getHeartbeat()
      .then(heartbeat => expect(heartbeat).to.eql(60));
  });

  it('can put', () => {
    return queue.put({ klass: 'Klass' })
      .then(jid => client.job(jid))
      .then(job => expect(job).to.be.ok());
  });

  it('can recur', () => {
    return queue.recur({ klass: 'Klass', interval: 60 })
      .then(jid => client.job(jid))
      .then(job => expect(job).to.be.ok());
  });

  it('can pop', () => {
    return queue.put({ klass: 'Klass', jid: 'jid' })
      .then(() => queue.pop())
      .then(job => expect(job.jid).to.eql('jid'));
  });

  it('can pop empty', () => {
    return queue.pop().then(job => expect(job).to.be(null));
  });

  it('can multipop', () => {
    return queue.put({ klass: 'Klass' })
      .then(() => queue.put({ klass: 'Klass' }))
      .then(() => queue.pop(10))
      .then(jobs => expect(jobs.length).to.eql(2));
  });

  it('can peek', () => {
    return queue.put({ klass: 'Klass', jid: 'jid' })
      .then(() => queue.peek())
      .then(job => expect(job.jid).to.eql('jid'));
  });

  it('can peek empty', () => {
    return queue.peek().then(job => expect(job).to.be(null));
  });

  it('can multipeek', () => {
    return queue.put({ klass: 'Klass' })
      .then(() => queue.put({ klass: 'Klass' }))
      .then(() => queue.peek(10))
      .then(jobs => expect(jobs.length).to.eql(2));
  });

  it('can get stats', () => {
    return queue.stats().then(stats => expect(stats.failures).to.eql(0));
  });

  it('can get length', () => {
    return queue.put({ klass: 'Klass' })
      .then(() => queue.length())
      .then(length => expect(length).to.eql(1));
  });
});
