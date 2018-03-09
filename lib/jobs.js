'use strict';

const Promise = require('bluebird');

const asArray = require('./util.js').asArray;
const Job = require('./job.js');

class Jobs {
  constructor(client) {
    this.client = client;
  }

  complete(offset, count) {
    return this.client.call('jobs', 'complete', offset || 0, count || 25);
  }

  tracked() {
    return this.client.call('track')
      .then(JSON.parse)
      .then((response) => {
        return Promise.map(response.jobs, config => new Job(this.client, config))
          .then((jobs) => {
            response.jobs = jobs;
          })
          .thenReturn(response);
      });
  }

  tagged(tag, offset, count) {
    return this.client.call('tag', 'get', tag, offset || 0, count || 25)
      .then(JSON.parse);
  }

  failed(group, offset, count) {
    if (!group) {
      return this.client.call('failed').then(JSON.parse);
    }
    return this.client.call('failed', group, offset || 0, count || 25)
      .then(JSON.parse)
      .then((response) => {
        response.jobs = asArray(response.jobs);
        return response;
      });
  }
}

module.exports = Jobs;
