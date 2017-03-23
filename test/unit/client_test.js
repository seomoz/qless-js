'use strict';

const os = require('os');
const process = require('process');

describe('qless.client', () => {
  describe('workerName', () => {
    it('has three parts include the hostname and pid', () => {
      qlessClient.workerName.should.match(/^[^-]+-.*-[0-9]+$/);
      qlessClient.workerName.should.include(os.hostname());
      qlessClient.workerName.should.include(process.pid.toString());
    });
  });

  describe('queue', () => {
    it('should return a single Queue instance for strings', () => {
      let queue = qlessClient.queue('foo');
      queue.constructor.name.should.eq('Queue')
    });

    it('should return an array of Queues for string arrays', () => {
      let queues = qlessClient.queue(['foo', 'bar']);
      Array.isArray(queues).should.eq(true);

      queues.forEach((queue) => {
        queue.constructor.name.should.eq('Queue')
      })
    });

    it('should deduplicate Queues when arrays are passed', () => {
      let queues = qlessClient.queue(['foo', 'foo']);
      Array.isArray(queues).should.eq(true);
      queues.length.should.eq(1)
      queues[0].name.should.eq('foo')
    });
  })
});
