/*
module.exports = {
  perform(job, cb) {
    console.log(`Performing job with foo=${job.data.foo}... please wait!`);
    setTimeout(() => {
      console.log(`I'm out of here! Done with foo=${job.data.foo}`);
      cb();
    }, 1000);
  }
}
*/

module.exports = {
  perform(job, cb) {
    console.log(`Performing job with foo=${job.data.foo}... please wait!`);
    setTimeout(() => {
      console.log(`I'm out of here! Done with foo=${job.data.foo}`);
      cb(new Error('wtf'));
      //cb('wtf');
    }, 1000);
  }
}
