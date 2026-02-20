---
description: Domain knowledge of Node.js Event Loop (official Node.js docs)
alwaysApply: true
---

# Event Loop in Node.js (libuv)

Use official Node.js docs as source of truth:
- https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks
- https://nodejs.org/en/learn/asynchronous-work/asynchronous-flow-control
- https://nodejs.org/en/learn/asynchronous-work/discover-promises-in-nodejs
- https://nodejs.org/en/learn/asynchronous-work/discover-javascript-timers
- https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking
- https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
- https://nodejs.org/en/learn/asynchronous-work/the-nodejs-event-emitter
- https://nodejs.org/en/learn/asynchronous-work/understanding-processnexttick
- https://nodejs.org/en/learn/asynchronous-work/understanding-setimmediate
- https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop

## Phase Order (each loop iteration)

1. **timers** — `setTimeout()`, `setInterval()`
2. **pending callbacks** — I/O callbacks deferred to next iteration (e.g. TCP ECONNREFUSED)
3. **idle, prepare** — internal only
4. **poll** — retrieve new I/O events, execute I/O callbacks; may block here; controls when timers run
5. **check** — `setImmediate()`
6. **close callbacks** — e.g. `socket.on('close')`

## process.nextTick() — NOT in the diagram

`process.nextTick()` is not part of the event loop phases. The nextTick queue is processed **after the current operation completes**, before the event loop continues to the next phase. "Operation" = transition from C/C++ handler to JS execution.

- Runs before setTimeout, setImmediate, any phase
- Can starve I/O if used recursively

## Task Queues Order

1. **process.nextTick** queue
2. **Promise microtask** queue (`queueMicrotask`, `.then()`, `.catch()`)
3. **Macrotask** queue (setTimeout, setImmediate — event loop phases)

## Key Facts for Visualization

- **libuv 1.45+ (Node 20+)**: timers run only after poll, not before and after
- **Poll phase**: if queue empty and no setImmediate, waits for callbacks; if timers ready, goes back to timers
- **setImmediate vs setTimeout(0)**: in I/O cycle (e.g. inside fs.readFile callback), setImmediate always first; in main module, order non-deterministic
- **Poll blocks** when appropriate — show "waiting" state if no work
