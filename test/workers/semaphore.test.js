'use strict';

const Promise = require('bluebird').Promise;
const expect = require('expect.js');

const Semaphore = require('../../lib/workers/semaphore.js');

describe('Semaphore', () => {
  const capacity = 5;
  let semaphore = null;

  beforeEach(() => {
    semaphore = new Semaphore(capacity);
  });

  it('limits concurrency', () => {
    const factor = 3;
    const promises = [];
    const counts = [];
    let running = 0;
    const handler = () => {
      running += 1;
      counts.push(running);
      const delay = Math.random() * 100;
      return Promise.delay(delay)
        .then(() => {
          running -= 1;
        });
    };

    for (let i = 0; i < capacity * factor; i += 1) {
      promises.push(semaphore.using(handler));
    }

    return Promise.all(promises)
      .then(() => {
        expect(Math.max.apply(null, counts)).to.eql(capacity);
      });
  });
});
