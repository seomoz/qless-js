'use strict';

process.env.NODE_ENV = 'test';
process.env.DEBUG = '*';

const chai = require('chai'),
    _ = require('lodash');

const expect = chai.expect;
chai.should();

const qless = require('../../qless');

const redisInfo = { db: 11 };
const qlessClient = new qless.Client(redisInfo);
beforeEach(cb => qlessClient.redis.flushdb(cb));

global.chai = chai;
global.expect = chai.expect;
global._ = _;
global.qless = qless;
global.qlessClient = qlessClient;

