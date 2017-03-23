'use strict';

process.env.NODE_ENV = 'test';

// Misc Utils
const _ = require('lodash');
const bluebird = require('bluebird');
const co = require('co');

// Testing Stuff
require('mocha-co');
const chai = require('chai');
const expect = chai.expect;
chai.should();

// Redis and Qless
const qless = require('../qless');
const redisInfo = { db: 11 };
const qlessClient = new qless.Client({db: 11 });
bluebird.promisifyAll(require('../lib/jobs'));
bluebird.promisifyAll(require('../lib/queue'));
bluebird.promisifyAll(require('../lib/job'));
bluebird.promisifyAll(require('../lib/config'));
bluebird.promisifyAll(qlessClient.redis);


beforeEach(function *() {
  yield qlessClient.redis.flushdbAsync();
  yield qlessClient.redis.scriptAsync('flush');
  qless.klassFinder.setModuleDir(__dirname + '/jobs');
});

afterEach(function () {
});

// Set all to be globals
global.chai = chai;
global.expect = chai.expect;
global._ = _;
global.qless = qless;
global.qlessClient = qlessClient;
global.bluebird = bluebird;
global.co = co;
