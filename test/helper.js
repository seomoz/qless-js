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
const qlessClient = new qless.Client(redisInfo);
bluebird.promisifyAll(qlessClient.jobs);
beforeEach(cb => qlessClient.redis.flushdb(cb));
beforeEach(cb => qlessClient.redis.script('flush', cb));

// Set all to be globals
global.chai = chai;
global.expect = chai.expect;
global._ = _;
global.qless = qless;
global.qlessClient = qlessClient;
global.bluebird = bluebird;
global.co = co;
