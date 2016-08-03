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
});

