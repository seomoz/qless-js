'use strict';

const sinon = require('sinon')

describe('qless.Job', () => {
  const fooQueue = qlessClient.queue('foo');

  it('has all the basic attributes we would expect', function *() {
    yield fooQueue.putAsync('Foo', {'whiz': 'bang'}, {jid:'jid', tags: ['foo'], retries: 3});
    const job = yield qlessClient.jobs.getAsync('jid');
    const attrs = _.pick(job, ['data', 'jid', 'priority', 'klassName', 'queueName', 'tags',
        'expiresAt', 'originalRetries', 'retriesLeft', 'workerName',
        'dependents', 'dependencies']);
    attrs.should.eql({
      'data': {'whiz': 'bang'},
      'dependencies': [],
      'dependents': [],
      'expiresAt': 0,
      'jid': 'jid',
      'klassName': 'Foo',
      'originalRetries': 3,
      'priority': 0,
      'queueName': 'foo',
      'retriesLeft': 3,
      'tags': ['foo'],
      'workerName': '',
    });
  });

  it("Able to complete a job", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'});
    const job1 = yield fooQueue.popAsync();
    yield job1.completeAsync();
    const job2 = yield qlessClient.jobs.getAsync('jid');
    job2.state.should.eql('complete');
  });

  it("Has a reasonable toString()", function *() {
    yield fooQueue.putAsync('Job', {}, {jid: 'jid'})
    const job = yield qlessClient.jobs.getAsync('jid');
    job.toString().should.eql('<qless.Job Job (jid / foo / waiting / {})>')
  });

  it("Raises an error if it can't require the klass (module)", function *() {
    yield fooQueue.putAsync('JobDefinitelyDoesntExist', {}, {jid: 'jid'})
    const job = yield fooQueue.popAsync();
    yield co.wrap(cb => {
      job.perform((err, val) => {
        err.should.be.an.instanceof(qless.errors.CouldntLoadClass);
        cb();
      });
    });
  });

  it("Raises an error if the klass (module) doesn't have a perform method", function *() {
    yield fooQueue.putAsync('JobWithoutAPerform', {}, {jid: 'jid'});
    const job = yield fooQueue.popAsync();
    yield co.wrap(cb => {
      job.perform((err, val) => {
        err.should.be.an.instanceof(qless.errors.ClassLackingPerformMethod);
        cb();
      });
    });
  });

  it("Exposes the class for a job", function *() {
    yield fooQueue.putAsync('JobWithoutAPerform', {}, {jid: 'jid'})
    const job = yield qlessClient.jobs.getAsync('jid');
    job.getKlass().should.eq(require('../jobs/JobWithoutAPerform'));
  });

  it("We can set a job's priority", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid', priority:0})
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.priority).to.eql(0);
    yield job.setPriorityAsync(10);
    yield(yield qlessClient.jobs.getAsync('jid')).setPriorityAsync(10);
    expect(job.priority).to.eql(10)
  });

  it('handles errors on set priority', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid', priority:0})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setPriority(100, (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a queueName", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    expect((yield qlessClient.jobs.getAsync('jid')).queueName).to.eql('foo')
  });

  // This differs from python where an AttributeError is raised
  it("Nonexistent attributes are undefined", function *() {
    yield fooQueue.putAsync('Job', {}, {jid: 'jid'})
    expect((yield qlessClient.jobs.getAsync('jid')).foo).to.eql(undefined)

  });

  it("Exposes the cancel method", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    yield job.cancelAsync()
    expect(yield qlessClient.jobs.getAsync('jid')).to.eql(null)
  });

  it('handles errors cancel', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setPriority((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes the ttl for a job", function *() {
    yield qlessClient.config.setAsync('heartbeat', 10);
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'});
    yield fooQueue.popAsync();
    expect((yield qlessClient.jobs.getAsync('jid')).ttl).to.be.below(10)
    expect((yield qlessClient.jobs.getAsync('jid')).ttl).to.be.above(9)
  });

  it("Provides access to heartbeat", function *() {
    yield qlessClient.config.setAsync('heartbeat', 10);
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    const job = yield fooQueue.popAsync();
    const before = job.ttl;
    yield qlessClient.config.setAsync('heartbeat', 20);
    yield job.heartbeatAsync();
    expect(job.ttl).to.be.above(before)
  });

  it("Failed heartbeats raise an error", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    const job = yield qlessClient.jobs.getAsync('jid');
    yield co.wrap(cb => {
      job.heartbeat((err, val) => {
        err.should.be.an.instanceof(qless.errors.LuaScriptError);
        cb();
      });
    });
  });

  it("Exposes a track, untrack method", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    const job = yield qlessClient.jobs.getAsync('jid')
    expect((yield qlessClient.jobs.getAsync('jid')).tracked).to.be.false;
    yield(yield qlessClient.jobs.getAsync('jid')).trackAsync()
    expect((yield qlessClient.jobs.getAsync('jid')).tracked).to.be.true;
    yield(yield qlessClient.jobs.getAsync('jid')).untrackAsync()
    expect((yield qlessClient.jobs.getAsync('jid')).tracked).to.be.false;
  });

  it('handles errors on track', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.track((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it('handles errors on untrack', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.untrack((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a way to tag and untag a job", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    yield(yield qlessClient.jobs.getAsync('jid')).tagAsync('foo')
    expect((yield qlessClient.jobs.getAsync('jid')).tags).to.deep.eql(['foo'])
    yield(yield qlessClient.jobs.getAsync('jid')).untagAsync('foo')
    expect((yield qlessClient.jobs.getAsync('jid')).tags).to.deep.eql([])
  });

  it('handles errors on tag', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.tag('foo', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it('handles errors on untag', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.untag('foo', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Retry raises an error if retry fails", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    const job = yield qlessClient.jobs.getAsync('jid');
    yield co.wrap(cb => {
      job.retry((err, val) => {
        err.should.be.an.instanceof(qless.errors.LuaScriptError);
        cb();
      });
    });
  });

  it("Able to move jobs through the move method", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    yield(yield qlessClient.jobs.getAsync('jid')).moveAsync('bar')
    expect((yield qlessClient.jobs.getAsync('jid')).queueName).to.eql('bar')
  });

  it('handles errors on move job', function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.move('newqueue', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a way to timeout a job", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
    const job = yield fooQueue.popAsync();
    yield job.timeoutAsync();
    expect((yield qlessClient.jobs.getAsync('jid')).state).to.eql('stalled');
  });

  it("Timeouts send LuaScriptError if not running", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'});
    const job = yield qlessClient.jobs.getAsync('jid');
    yield co.wrap(cb => {
      job.timeout((err, val) => {
        err.should.be.an.instanceof(qless.errors.LuaScriptError);
        cb();
      });
    });
  });

  it("Exposes a way to pause and unpause a queue", function *() {
    yield fooQueue.putAsync('Foo', {}, {jid: 'jid'});
    yield fooQueue.pauseAsync()
    expect((yield fooQueue.popAsync())).to.eql(null)
    yield fooQueue.unpauseAsync()
    expect((yield fooQueue.popAsync()).jid).to.eql('jid')
  });

  /*
   * The following tests were copied from qless-py (with some syntax changed
   * from Python to Javascript) and describe functionality not yet
   * implemented qless Javascript (some may not even be appropriate for Javascript).
   * They are kept here for easy use if/when we add the features described.

        // nextq
      it("Able to advance a job to another queue", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        yield(yield fooQueue.popAsync()).completeAsync('bar')
        fooQueue.pop().complete('bar')
        self.assertEqual(qlessClient.jobs['jid'].state, 'waiting')
      });

      it("Exposes a depend, undepend methods", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'a'})
        yield fooQueue.putAsync('Foo', {}, {jid: 'b'})
        yield fooQueue.putAsync('Foo', {}, {jid: 'c', depends=['a']})
        self.assertEqual(qlessClient.jobs['c'].dependencies, ['a'])
        qlessClient.jobs['c'].depend('b')
        self.assertEqual(qlessClient.jobs['c'].dependencies, ['a', 'b'])
        qlessClient.jobs['c'].undepend('a')
        self.assertEqual(qlessClient.jobs['c'].dependencies, ['b'])
        qlessClient.jobs['c'].undepend(all=True)
        self.assertEqual(qlessClient.jobs['c'].dependencies, [])
      });


       it("Sets jobs data through []", function *() {
       yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
       job = yield qlessClient.jobs.getAsync('jid')
       job['foo'] = 'bar'
       self.assertEqual(job['foo'], 'bar')
       });

      it("Ensure that nothing blows up if we reload a class", function *() {
        yield fooQueue.putAsync(Foo, {}, {jid: 'jid'})
        self.assertEqual(qlessClient.jobs['jid'].klass, Foo)
        Job.reload(qlessClient.jobs['jid'].klass_name)
        self.assertEqual(qlessClient.jobs['jid'].klass, Foo)
      });

      it("Don't blow up we cannot check the modification time of a module.", function *() {
        exc = OSError('Could not stat file')
        with mock.patch('qless.job.os.stat', side_effect=exc):
          Job._import('test_job.Foo')
          Job._import('test_job.Foo')
      });
  */

});

describe('qless.RecurJob', () => {
  const fooQueue = qlessClient.queue('foo');

  it('We can access all the recurring attributes', function *() {
    //klassName, data, interval, opts, cb
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid:'jid', tags: ['foo'], retries: 3});
    const job = yield qlessClient.jobs.getAsync('jid');
    const attrs = _.pick(job, ['data', 'jid', 'priority', 'klassName', 'queueName', 'tags',
      'retries', 'interval', 'count' ]);
    attrs.should.eql({
      'count': 0,
      'data': {'whiz': 'bang'},
      'interval': 60,
      'jid': 'jid',
      'klassName': 'Foo',
      'priority': 0,
      'queueName': 'foo',
      'retries': 3,
      'tags': ['foo']
    });
  });

  it("We can set priority on recurring jobs", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid:'jid', priority: 0});
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.priority).to.eql(0);
    yield job.setPriorityAsync(10);
    expect((yield qlessClient.jobs.getAsync('jid')).priority).to.eql(10);
    expect(job.priority).to.eql(10)
  });

  it('handles errors on set priority', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setPriority(100, (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("We can set retries", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid', retries: 2});
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.retries).to.eql(2);
    yield job.setRetriesAsync(10);
    expect((yield qlessClient.jobs.getAsync('jid')).retries).to.eql(10);
    expect(job.retries).to.eql(10)
  });

  it('handles errors on set retries', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setRetries(100, (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("We can set interval", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.interval).to.eql(60);
    yield job.setIntervalAsync(10);
    expect((yield qlessClient.jobs.getAsync('jid')).interval).to.eql(10);
    expect(job.interval).to.eql(10)
  });

  it('handles errors on set interval', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setInterval(100, (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("We can set data", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    yield job.setDataAsync({'foo': 'bar'});
    expect((yield qlessClient.jobs.getAsync('jid')).data).to.deep.eql({'foo': 'bar'});
    expect(job.data).to.deep.eql({'foo': 'bar'})
  });

  it('handles errors on set data', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setData({}, (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("We can set the klass", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.klassName).to.eql('Foo');
    yield job.setKlassAsync('Bar');
    expect((yield qlessClient.jobs.getAsync('jid')).klassName).to.eql('Bar');
    expect(job.klassName).to.eql('Bar')
  });

  it('handles errors on set klass', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.setKlass('bar', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a way move a recurring job", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    yield(yield qlessClient.jobs.getAsync('jid')).moveAsync('bar')
    expect((yield qlessClient.jobs.getAsync('jid')).queueName).to.eql('bar')
  });

  it('handles errors on move job', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.move('newqueue', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a way to cancel jobs", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    yield job.cancelAsync()
    expect(yield qlessClient.jobs.getAsync('jid')).to.eql(null)
  });

  it('handles errors on cancel', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.cancel((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it('handles errors in config fetches', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.cancel((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it("Exposes a way to tag and untag a recurring job", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    yield(yield qlessClient.jobs.getAsync('jid')).tagAsync('foo')
    expect((yield qlessClient.jobs.getAsync('jid')).tags).to.deep.eql(['foo'])
    yield(yield qlessClient.jobs.getAsync('jid')).untagAsync('foo')
    expect((yield qlessClient.jobs.getAsync('jid')).tags).to.deep.eql([])
  });

  it('handles errors on tag', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.tag('foo', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  it('handles errors on untag', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.untag('foo', (err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  });

  // This differs from python where an AttributeError is raised
  it("Nonexistent attributes are undefined", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    expect((yield qlessClient.jobs.getAsync('jid')).foo).to.eql(undefined)

  });

  it("Exposes a way to update the recurring job", function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    job.data = {'foo': 'bar'}
    yield job.updateAsync()
    var job = yield qlessClient.jobs.getAsync('jid');
    expect(job.data).to.deep.eql({'foo': 'bar'})
  });

  it('handles errors on update', function *() {
    yield fooQueue.recurAsync('Foo', {'whiz': 'bang'}, 60, {jid: 'jid'});
    var job = yield qlessClient.jobs.getAsync('jid');
    sinon.stub(fooQueue.client, 'call').yields("BOOM", null)
    yield co.wrap(cb => {
      job.update((err, val) => {
        expect(err).to.eql("BOOM");
        cb();
      });
    });
    fooQueue.client.call.restore()
  })
});

/*
UNIT tests pulled from RecurJob from the qless-py client


 def test_get_next(self):
 '''Exposes the next time a job will run'''
 self.client.queues['foo'].recur('Foo', {}, 60, jid='jid')
 nxt = self.client.jobs['jid'].next
 self.client.queues['foo'].pop()
 self.assertTrue(abs(self.client.jobs['jid'].next - nxt - 60) < 1)

 */
 