'use strict';

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

  /*
   * The following tests were copied from qless-py (with some syntax changed
   * from Python to Javascript) and describe functionality not yet
   * implemented qless Javascript (some may not even be appropriate for Javascript).
   * They are kept here for easy use if/when we add the features described.

      it("We can set a job's priority", function *() {
        yield yield fooQueue.putAsync('Foo', {}, {jid: 'jid', priority:0})
        expect((yield qlessClient.jobs.get('jid')).priority).to.eql(0);
        yield (yield qlessClient.jobs.get('jid')).setPriority(0);
        expect((yield qlessClient.jobs.get('jid')).priority).to.eql(10);
      });


      it("Exposes a queue object", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        self.assertEqual(qlessClient.jobs['jid'].queue.name, 'foo')
      });

      it("Exposes the ttl for a job", function *() {
        qlessClient.config['heartbeat'] = 10
        yield fooQueue.putAsync(Job, {}, {jid: 'jid'})
        fooQueue.pop()
        self.assertTrue(qlessClient.jobs['jid'].ttl < 10)
        self.assertTrue(qlessClient.jobs['jid'].ttl > 9)
      });

      it("Raises an attribute error for nonexistent attributes", function *() {
        yield fooQueue.putAsync(Job, {}, {jid: 'jid'})
        self.assertRaises(AttributeError, lambda: qlessClient.jobs['jid'].foo)
      });

      it("Exposes the cancel method", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        qlessClient.jobs['jid'].cancel()
        self.assertEqual(qlessClient.jobs['jid'], None)
      });

      it("Exposes a way to tag and untag a job", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        qlessClient.jobs['jid'].tag('foo')
        self.assertEqual(qlessClient.jobs['jid'].tags, ['foo'])
        qlessClient.jobs['jid'].untag('foo')
        self.assertEqual(qlessClient.jobs['jid'].tags, [])
      });

      it("Sets jobs data through []", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        job = qlessClient.jobs['jid']
        job['foo'] = 'bar'
        self.assertEqual(job['foo'], 'bar')
      });

      it("Able to move jobs through the move method", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        qlessClient.jobs['jid'].move('bar')
        self.assertEqual(qlessClient.jobs['jid'].queue.name, 'bar')
      });

      it("Able to advance a job to another queue", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        fooQueue.pop().complete('bar')
        self.assertEqual(qlessClient.jobs['jid'].state, 'waiting')
      });

      it("Provides access to heartbeat", function *() {
        qlessClient.config['heartbeat'] = 10
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        job = fooQueue.pop()
        before = job.ttl
        qlessClient.config['heartbeat'] = 20
        job.heartbeat()
        self.assertTrue(job.ttl > before)
      });


      it("Failed heartbeats raise an error", function *() {
        from qless.exceptions import LostLockException
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        self.assertRaises(LostLockException, qlessClient.jobs['jid'].heartbeat)
      });


      it("Exposes a track, untrack method", function *() {
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        self.assertFalse(qlessClient.jobs['jid'].tracked)
        qlessClient.jobs['jid'].track()
        self.assertTrue(qlessClient.jobs['jid'].tracked)
        qlessClient.jobs['jid'].untrack()
        self.assertFalse(qlessClient.jobs['jid'].tracked)
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

      it("Retry raises an error if retry fails", function *() {
        from qless.exceptions import QlessException
        yield fooQueue.putAsync('Foo', {}, {jid: 'jid'})
        self.assertRaises(QlessException, qlessClient.jobs['jid'].retry)
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

