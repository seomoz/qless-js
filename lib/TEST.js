'use strict';

const client = new (require('./client').Client)();
client.queue('myqueue').put('MyClass', {foo: 'bar'}, {}, (err, res) => {
  if (err) {
    console.log("error: ", err, err.message);
  } else {
    console.log('success');
    client.queue('myqueue').pop((err, job) => {
      console.log("error is: ", err);
      console.log("job is: ", job);
    });
  }
});
