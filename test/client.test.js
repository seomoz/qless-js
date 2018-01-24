'use strict';

const path = require('path');

const Promise = require('bluebird');

const expect = require('expect.js');
const Client = require('../lib/client.js');
const helper = require('./helper.js');
const QlessError = require('../lib/errors.js').QlessError;

describe('Qless client', () => {
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);

  beforeEach(() => cleaner.before());

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  it('can invoke call', () => {
    return client.call('tag', 'top', 0, 100)
      .then(response => expect(response).to.be('{}'));
  });

  it('wraps errors in QlessError', () => {
    return client.call('complete', 'jid')
      .catch(err => expect(err).to.be.a(QlessError));
  });

  it('memoizes SHA', () => {
    client.sha = null;
    return client.call('tag', 'top', 0, 100)
      .then(() => {
        expect(client.sha).to.not.be(null);
        return client.call('tag', 'top', 0, 100);
      })
      .then(response => expect(response).to.be('{}'));
  });

  it('exposes using', () => {
    // This test passes if the jest processes terminates on its own
    const config = {
      url,
      workerName: 'my-worker-name',
    };
    return Client.using(config, local => local.redis.infoAsync());
  });

  describe('with several jobs', () => {
    const jids = ['one', 'two', 'three'];

    beforeEach(() => {
      return Promise.map(jids, (jid) => {
        return client.queue('queue').put({
          klass: 'klass',
          jid,
        });
      });
    });

    it('can track jobs in bulk', () => {
      return client.track('one', 'two', 'three')
        .then(() => Promise.map(jids, jid => client.job(jid)))
        .then(jobs => jobs.map(job => job.tracked))
        .then(tracked => expect(tracked).to.eql([true, true, true]));
    });

    it('can untrack jobs in bulk', () => {
      return client.track('one', 'two', 'three')
        .then(() => client.untrack('one', 'two', 'three'))
        .then(() => Promise.map(jids, jid => client.job(jid)))
        .then(jobs => jobs.map(job => job.tracked))
        .then(tracked => expect(tracked).to.eql([false, false, false]));
    });

    it('can cancel jobs in bulk', () => {
      return client.cancel('one', 'two', 'three')
        .then(() => Promise.map(jids, jid => client.job(jid)))
        .then(jobs => expect(jobs).to.eql([null, null, null]));
    });
  });

  it('can set config', () => {
    const key = 'key';
    const value = 'value';
    return client.setConfig(key, value)
      .then(() => client.getConfig(key))
      .then(actual => expect(actual).to.eql(value));
  });

  it('can get single non-JSON config', () => {
    return client.getConfig('application')
      .then(value => expect(value).to.eql('qless'));
  });

  it('can get all config', () => {
    const expected = {
      'application': 'qless',
      'grace-period': 10,
      'stats-history': 30,
      'jobs-history': 604800,
      'heartbeat': 60,
      'jobs-history-count': 50000,
      'histogram-history': 7,
    };
    return client.getConfig()
      .then(response => expect(response).to.eql(expected));
  });

  it('gets nothing for nonexistent jobs', () => {
    return client.job('jid').then(job => expect(job).to.be(null));
  });

  describe('with bad path', () => {
    const badClient = new Client(url);

    beforeEach(() => {
      badClient.path = path.resolve(__dirname, 'some/path/that/does/not/exist');
    });

    afterAll(() => badClient.quit());

    it('throws a QlessError on load', () => {
      return badClient.load()
        .catch(err => expect(err).to.be.a(QlessError));
    });
  });
});
