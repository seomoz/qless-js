class Job {
  static process(job) {
    return job.fork(() => job.complete());
  }

  static abort(job) {
    return job.fork(() => process.exit(1));
  }
}

module.exports = Job;
