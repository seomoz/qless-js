# qless-js

![Status: Incubation](https://img.shields.io/badge/status-incubation-green.svg?style=flat)
![Team: Shared Services](https://img.shields.io/badge/team-shared_services-green.svg?style=flat)
![Product: Keyword Explorer](https://img.shields.io/badge/product-keyword_explorer-blue.svg?style=flat)
![Open Source](https://img.shields.io/badge/open_source-yes-green.svg?style=flat)
![Critical: No](https://img.shields.io/badge/critical-no-green.svg?style=flat)

Requires Node >= 4, or Babel. (Note that Node 0.12's end of life is December 2016.)

__Note__: While this is not a complete port, it supports the most important
functionality. See [To-dos](#to-dos) below.

## Qless Features

For a more complete discussion of the features, consult the documentation of the
[Python bindings](http://github.com/seomoz/qless-py). The short list:

- Recurring jobs
- Job heartbeating / exclusive locks
- Retries for dropped jobs
- Job dependencies (useful for creating chains of jobs)
- Scheduled jobs
- __TODO__: Job sandboxes

## Installation

Available on `npm`:

```bash
npm install qless-js
```

## Business Time

All asychronous parts of the API (which is most of it), return promises.

This example puts a job of class `mymodule.MyClass` in a queue `myQueue` in a
local redis instance:

```javascript
// myproject/enqueue.js
'use strict';

// Create our client
const qless = require('qless');
const client = new qless.Client('redis://localhost:6379')

// Pick a queue
const queue = client.queue('myQueue');

// Put a job in that queue
const jobConfig = {
  klass: 'mymodule.MyClass',
  data: {
    foo: 'bar',
  },
}
queue.put(jobConfig).then((jid) => {
  console.log('Put jid', jid);
}).catch((err) => {
  console.log('Exception', err);
})
```

But when this job is run, what will it do? To this end, let's define our class.
There are more ways than this to define our jobs, but more on that in the
[Job Class Importing](#job-class-importing) section below.

The function that gets run is `<job class>.<queue name>`. So our example will
run a `MyClass.myQueue` function, passing the popped job. This function:

- _must_ return a promise
- _should_ ultimately return the `job.complete()` promise if successful

When processing the job, any exceptions propagated out will result in the job
being marked as `failed`.

```javascript
// mymodule
class MyClass {

  // This method has two requirements:

  static myQueue(job) {
    return someAsynchronousWork()
      .then(() => {
        return someMoreAsynchronousWork();
      })
      .then(() => {
        return job.complete();
      })
  }
}
```

As for running these jobs, `qless-js` comes with an executable that will
continuously pop and run jobs:

```bash
qless-js-worker \
  --redis='redis://my-redis-host:6379/' \
  --queue=myQueue
```

## Job Class Importing

The importing logic tries to `require` the klass string provided the job config.
Failing that, it will strip off the last path segment (`/`-separated), and try
importing that, treating the last segment as a property name of the imported
entity. This continues until there's a successful `require` or until there is
nothing that can be imported, in which case an exception is raised.

Put another way, Split the provided name by `/`, and import the longest working
prefix. The remaining components will be treated as attributes off of the
import.

For example, consider 'some/package/file.js/property/class'. We would traverse
this as:

- import 'some/package/file.js/property/class' (failed)
- import 'some/package/file.js/property', get 'class' attribute (failed)
- import 'some/package/file.js', get 'property.class' attribute (success)

Technically, the targeted entity doesn't have to be a class. That's merely a
convention inherited from other bindings. It must merely be an object with a
property `<queue name>` which is a function that takes a job argument an returns
a promise. For example, this would be a completely valid structure:

```javascript
module.exports = {
  queueOne: (job) => { ... },
  queueTwo: (job) => { ... },
}
```

__Note__: A job class cannot be a path, by default. There is a [to-do](#to-dos)
about a way to optionally enable this for development. The reasoning is that it
may be a security risk to enable the import of arbitrary modules when a job is
enqueued. It's much better to require the module to have been installed (rather
than just an arbitrary file on a worker's filesystem) in the environment of the
worker.

## Forking

Since some jobs are CPU-intensive, `qless` provides a `fork` method on the job
object. It accepts a function that should be run for the job, and returns a
promise. It runs that function in its own subprocess, and heartbeats that job
from the parent process until the job completes:

```javascript
class Job {
  static queue(job) {
    return job.fork(() => {
      // Something really CPU intensive
      return job.complete();
    });
  }
}
```

## Running Jobs

There are number of additional bells and whistles when running jobs with
`qless-js-worker`.

### Worker name (`--name`)

The worker name uniquely identifies the processing entity (the worker). However,
different deployments may require the use of a workername other than just the
hostname.

### Concurrency (`--concurrency`)

When running heavily asynchronous workloads, parallelization is possible with
the `--concurrency` option. It specifies the number of concurrent jobs that can
be run on a single core.

### Interval (`--interval`)

This configures the polling interval for looking for new jobs. The worker will
try to pop jobs from the queues it's configured to work from (in round-robin
order). Only when there are no jobs available does the worker sleep for the
provided interval before checking again. Otherwise, immediately after completing
a job, it checks for another.

### Multiple queues (`--queue`)

A worker can grab jobs from multiple queues, as they're available. They're
popped from the configured queues in round-robin order. To add multiple queues,
just provide the `--queue` option multiple times:

```bash
qless-js-worker \
  --redis='redis://my-redis-host:6379' \
  --queue=queueOne \
  --queue=queueTwo \
  --queue=queueThree
```

### Verbose logging

Use `-v` to enable verbose logging, including information log messages. Use
`-vv` to enable debugging output as well.

### Allow Paths as Job Klasses (`--allow-paths`)

This option allows the running of `Job`s with a path as a `klass`, like
`/some/absolute/path/for/my/job.js`. This is useful for development.

## Updating Qless Lua Scripts

This repo contains a submodule to the core `qless` scripts, which can be updated
with the `build` command:

```bash
npm run build
```

## To-Dos

In no particular order of complexity or importance:

- Sandbox work directory
- Have an exception hierarchy (Qless exceptions on down)
- Workers don't fail job on lost lock exception
- Use multiple cores (until then, it's recommended to use parameterized upstart)
- Support the `--resume` option
- Recurring job objects (there's no `RecurringJob` class yet)
- Job events

## Development

### Environment

Using `yarn`, and assuming you have a locally-running `redis`:

```bash
yarn build
yarn install
```

### Running Tests

Tests are again run with `yarn`, as is linting:

```bash
yarn run test
yarn run lint
```

## PRs

These are not all hard-and-fast rules, but in general PRs have the following expectations:

- __pass Travis__ -- or more generally, whatever CI is used for the particular project
- __be a complete unit__ -- whether a bug fix or feature, it should appear as a complete
    unit before consideration.
- __maintain code coverage__ -- some projects may include code coverage requirements as
    part of the build as well
- __maintain the established style__ -- this means the existing style of established
    projects, the established conventions of the team for a given language on new
    projects, and the guidelines of the community of the relevant languages and
    frameworks.
- __include failing tests__ -- in the case of bugs, failing tests demonstrating the bug
    should be included as one commit, followed by a commit making the test succeed. This
    allows us to jump to a world with a bug included, and prove that our test in fact
    exercises the bug.
- __be reviewed by one or more developers__ -- not all feedback has to be accepted, but
    it should all be considered.
- __avoid 'addressed PR feedback' commits__ -- in general, PR feedback should be rebased
    back into the appropriate commits that introduced the change. In cases, where this
    is burdensome, PR feedback commits may be used but should still describe the changed
    contained therein.

PR reviews consider the design, organization, and functionality of the submitted code.

## Commits

Certain types of changes should be made in their own commits to improve readability. When
too many different types of changes happen simultaneous to a single commit, the purpose of
each change is muddled. By giving each commit a single logical purpose, it is implicitly
clear why changes in that commit took place.

- __updating / upgrading dependencies__ -- this is especially true for invocations like
    `yarn update`.
- __introducing a new dependency__ -- often preceeded by a commit updating existing
    dependencies, this should only include the changes for the new dependency.
- __refactoring__ -- these commits should preserve all the existing functionality and
    merely update how it's done.
- __utility components to be used by a new feature__ -- if introducing an auxiliary class
    in support of a subsequent commit, add this new class (and its tests) in its own
    commit.
- __config changes__ -- when adjusting configuration in isolation
- __formatting / whitespace commits__ -- when adjusting code only for stylistic purposes.

### New Features

Small new features (where small refers to the size and complexity of the change, not the
impact) are often introduced in a single commit. Larger features or components might be
built up piecewise, with each commit containing a single part of it (and its corresponding
tests).

### Bug Fixes

In general, bug fixes should come in two-commit pairs: a commit adding a failing test
demonstrating the bug, and a commit making that failing test pass.

## Tagging and Versioning

Whenever the version included in `package.json` is changed (and it should be changed when
appropriate using [http://semver.org/](http://semver.org/)), a corresponding tag should
be created with the same version number (formatted `v<version>`).

```bash
git tag -a v0.1.0 -m 'Version 0.1.0

This release contains an initial working version of the `crawl` and `parse`
utilities.'

git push origin
```
