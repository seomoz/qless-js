'use strict';

const expect = require('expect.js');
const Client = require('../lib/client.js');
const helper = require('./helper.js');

describe('Jobs', () => {
  const url = process.env.REDIS_URL;
  const client = new Client(url);
  const cleaner = new helper.Cleaner(client);
  const queue = client.queue('queue');
  const jid = 'jid';

  beforeEach(() => cleaner.before());

  afterEach(() => cleaner.after());

  afterAll(() => client.quit());

  beforeEach(() => {
    return queue.put({ klass: 'klass', jid });
  });

  it('provides access to empty completed jobs', () => {
    return client.jobs.complete().then((jobs) => {
      expect(jobs).to.eql([]);
    });
  });

  it('provides access to completed jobs', () => {
    return queue.pop()
      .then(job => job.complete())
      .then(() => client.jobs.complete(0, 10))
      .then(jobs => expect(jobs).to.eql([jid]));
  });

  it('provides access to tracked jobs', () => {
    return client.job(jid)
      .then(job => job.track())
      .then(() => client.jobs.tracked())
      .then(jobs => jobs.jobs.map(job => job.jid))
      .then(jids => expect(jids).to.eql([jid]));
  });

  it('provides access to empty failed jobs', () => {
    return client.jobs.failed('group')
      .then(response => expect(response).to.eql({ jobs: [], total: 0 }));
  });

  describe('with failed jobs', () => {
    const group = 'failure-group';
    const message = 'failure-message';

    beforeEach(() => {
      return queue.pop()
        .then(job => job.fail(group, message));
    });

    it('provides failure groups', () => {
      return client.jobs.failed()
        .then(groups => expect(groups).to.eql({ [group]: 1 }));
    });

    it('provides failed jobs', () => {
      return client.jobs.failed(group)
        .then(response => expect(response).to.eql({ jobs: [jid], total: 1 }));
    });
  });
});
