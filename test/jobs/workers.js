'use strict';

class BasicJob {
  static process(job) {
    return job.complete();
  }
}

module.exports = {
  BasicJob,
};
