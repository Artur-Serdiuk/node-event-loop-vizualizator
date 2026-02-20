import type { EventLoopPhase } from "../types/eventLoop";

export const PHASE_ORDER: EventLoopPhase[] = [
  "timers",
  "pending",
  "idle",
  "poll",
  "check",
  "close",
];

export const PHASE_LABELS: Record<EventLoopPhase, string> = {
  timers: "Timers",
  pending: "Pending I/O",
  idle: "Idle / Prepare",
  poll: "Poll",
  check: "Check",
  close: "Close Callbacks",
};

export const PHASE_DESCRIPTIONS: Record<
  EventLoopPhase | "microtask" | "idle",
  string
> = {
  timers: "Executes callbacks scheduled by setTimeout() and setInterval()",
  pending: "Executes I/O callbacks deferred to the next loop iteration",
  idle: "Used internally by Node.js only",
  poll: "Retrieves new I/O events; executes I/O-related callbacks",
  check: "Executes setImmediate() callbacks",
  close: 'Executes close event callbacks (e.g. socket.on("close"))',
  microtask: "Executes process.nextTick() and Promise microtasks",
};

export const PHASE_APIS: Record<EventLoopPhase | "microtask", string[]> = {
  timers: ["setTimeout()", "setInterval()"],
  pending: ["TCP errors", "I/O callbacks"],
  idle: ["internal use"],
  poll: ["fs.readFile()", "http.request()"],
  check: ["setImmediate()"],
  close: ['socket.on("close")', 'server.on("close")'],
  microtask: ["process.nextTick()", "Promise.then()", "queueMicrotask()"],
};

export const PHASE_COLORS: Record<EventLoopPhase | "microtask", string> = {
  timers: "#ff6b6b",
  pending: "#ffa500",
  idle: "#808080",
  poll: "#4ecdc4",
  check: "#95e1d3",
  close: "#c7ceea",
  microtask: "#ffd93d",
};
