module.exports = {
  perform(job, cb) {
    console.log(`Performing job with foo=${job.data.foo}... please wait!`);
    setTimeout(() => {
      console.log(`I'm out of here! Done with foo=${job.data.foo}`);
      cb();
    }, 1000);
  }
}
