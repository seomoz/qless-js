Limitations / TODOs

# Priority 1
~~- only allows one worker at a time due to hard-coded worker name~~
~~- only allows worker to read from one queue~~
~~- ttl & heartbeat not implemented -- longer running jobs won't work well~~
~~need to support retry for certain error types / messages~~
- stalled jobs might not be handled right? (worst case is user has to go under "stalled" and timeout the jobs manually)
- might have to check how i handle redis connection/TCP-level errors -- may cause unexpected behavior (but qless is safe so jobs shouldn't be dropped on the floor)
- Limitations not to be fixed this sprint:

# Priority 2
~~lots of other unimplemented functionality, such as recurring jobs and tracked jobs~~
- requires node >= 4 -- should be avoidable with Babel -- maybe automatically with npm magic?
- need to look through Python and Ruby classes and see what functionlity
  we have missed for the following classes:
  - Job
  - Jobs (ClientJobs)
  - Queue
  - Queues (ClientQueues)
  - Client
  - check if there are any other classes
- ability to reload job modules  

# NOTES and BACKLOG
- implemented explicity set\get methods for item that were handled with __getitem__ __setitem in python.  Could use Proxy objects, but that would require node > 4
- need to cleanup how stubs are restored to be more resilient to test failures