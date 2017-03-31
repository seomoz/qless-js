'use strict';

const expect = require('expect.js');
const Client = require('../lib/client.js');
const helper = require('./helper.js');

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
});
