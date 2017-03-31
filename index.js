const Client = require('./lib/client.js');
const Single = require('./lib/workers/single.js');
const Multi = require('./lib/workers/multi.js');
const logger = require('./lib/logger.js');

module.exports = {
  Client,
  logger,
  workers: {
    Single,
    Multi,
  }
}
