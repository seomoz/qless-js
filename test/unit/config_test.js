'use strict';

const sinon = require('sinon')

describe('qless.Config', () => {
  const fooQueue = qlessClient.queue('foo');

  it('gets all default keys as expected', function *() {
    const settings = yield fooQueue.config.getAllAsync()
    const attrs = _.pick(settings, [ 'application', 'grace-period', 'stats-history', 'jobs-history', 'heartbeat',
      'jobs-history-count', 'histogram-history' ]);
    settings.should.eql({
      'application': 'qless',
      'grace-period': 10,
      'stats-history':30,
      'jobs-history':604800,
      'heartbeat':60,
      'jobs-history-count':50000,
      'histogram-history':7
    })
  });

  it('handles errors in config fetches', function *() {
    let stub = sinon.stub(fooQueue.client, 'call');
    stub.yields("BOOM", null)
    yield co.wrap(cb => {
      fooQueue.config.clear((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });

    fooQueue.client.call.restore()
  })

  it('gets a specific key', function *() {
    expect(yield fooQueue.config.getAsync('heartbeat')).to.eql(60)
  });

  it('a missing key is null', function *() {
    expect(yield fooQueue.config.getAsync('foo')).to.eql(null)
  });

  it('exposes a way to set and unset keys', function *() {
    expect(yield fooQueue.config.getAsync('heartbeat')).to.eql(60)
    yield fooQueue.config.setAsync('heartbeat', 10)
    // @TODO why is this coerced to a string?
    expect(yield fooQueue.config.getAsync('heartbeat')).to.eql('10')
    yield fooQueue.config.unsetAsync('heartbeat')
    expect(yield fooQueue.config.getAsync('heartbeat')).to.eql(60)
  });

  it('exposes a way to clear all keys to their defaults', function *() {
    yield fooQueue.config.setAsync('heartbeat', 1);
    yield fooQueue.config.setAsync('grace-period', 1);
    yield fooQueue.config.clearAsync();
    expect(yield fooQueue.config.getAsync('heartbeat')).to.eql(60);
    expect(yield fooQueue.config.getAsync('grace-period')).to.eql(10);
  })

});
