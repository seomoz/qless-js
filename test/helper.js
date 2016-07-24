'use strict';

require('mocha-co');

process.env.NODE_ENV = 'test';

const chai = require('chai');
const _ = require('lodash');
const bluebird = require('bluebird');
const co = require('co');

const expect = chai.expect;
chai.should();

const qless = require('../qless');

const redisInfo = { db: 11 };
const qlessClient = new qless.Client(redisInfo);
beforeEach(cb => qlessClient.redis.flushdb(cb));
beforeEach(cb => qlessClient.redis.script('flush', cb));

global.chai = chai;
global.expect = chai.expect;
global._ = _;
global.qless = qless;
global.qlessClient = qlessClient;
global.bluebird = bluebird;
global.co = co;
