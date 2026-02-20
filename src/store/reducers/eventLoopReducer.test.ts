import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  eventLoopReducer,
  type ReducerState,
} from "./eventLoopReducer";
import type { Task, ConsoleOutput, CodeStatement } from "../../types/eventLoop";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_1",
    type: "setTimeout",
    label: "setTimeout(test, 0)",
    callback: "test",
    phase: "timers",
    delay: 0,
    createdAtTick: 0,
    executeAtTick: 0,
    ...overrides,
  };
}

function makeSyncOutput(overrides: Partial<ConsoleOutput> = {}): ConsoleOutput {
  return {
    id: "out_1",
    text: "hello",
    tick: 0,
    phase: "sync",
    taskType: "sync",
    ...overrides,
  };
}

function makeStatement(overrides: Partial<CodeStatement> = {}): CodeStatement {
  return {
    startLine: 1,
    endLine: 1,
    source: "console.log('test');",
    ...overrides,
  };
}

/** Dispatch a sequence of actions and return the final state */
function dispatchAll(
  initial: ReducerState,
  ...actions: Parameters<typeof eventLoopReducer>[1][]
): ReducerState {
  return actions.reduce(
    (state, action) => eventLoopReducer(state, action),
    initial,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("eventLoopReducer", () => {
  let state: ReducerState;

  beforeEach(() => {
    state = createInitialState();
  });

  // ── Initial state ─────────────────────────────────────────────────

  describe("createInitialState", () => {
    it("returns correct defaults", () => {
      const s = state.eventLoop;
      expect(s.currentPhase).toBe("stopped");
      expect(s.isRunning).toBe(false);
      expect(s.isPaused).toBe(false);
      expect(s.finished).toBe(false);
      expect(s.tick).toBe(0);
      expect(s.currentIteration).toBe(0);
      expect(s.callStack).toEqual([]);
      expect(s.consoleOutput).toEqual([]);
      expect(s.executionHistory).toEqual([]);
      expect(state.speed).toBe(1);
    });

    it("has empty phase queues", () => {
      const q = state.eventLoop.phaseQueues;
      expect(q.timers).toEqual([]);
      expect(q.pending).toEqual([]);
      expect(q.idle).toEqual([]);
      expect(q.poll).toEqual([]);
      expect(q.check).toEqual([]);
      expect(q.close).toEqual([]);
    });

    it("has empty microtask queues", () => {
      const m = state.eventLoop.microtasks;
      expect(m.nextTick).toEqual([]);
      expect(m.promises).toEqual([]);
    });
  });

  // ── LOAD_TASKS ────────────────────────────────────────────────────

  describe("LOAD_TASKS", () => {
    it("distributes tasks to correct phase queues", () => {
      const timerTask = makeTask({ id: "t1", phase: "timers" });
      const checkTask = makeTask({
        id: "t2",
        type: "setImmediate",
        phase: "check",
      });

      const result = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [timerTask, checkTask], syncOutputs: [] },
      });

      expect(result.eventLoop.phaseQueues.timers).toHaveLength(1);
      expect(result.eventLoop.phaseQueues.check).toHaveLength(1);
    });

    it("distributes microtasks to nextTick queue", () => {
      const nextTickTask = makeTask({
        id: "t1",
        type: "nextTick",
        phase: "microtask",
      });

      const result = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [nextTickTask], syncOutputs: [] },
      });

      expect(result.eventLoop.microtasks.nextTick).toHaveLength(1);
    });

    it("distributes promises to promises queue", () => {
      const promiseTask = makeTask({
        id: "t1",
        type: "promise",
        phase: "microtask",
      });

      const result = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [promiseTask], syncOutputs: [] },
      });

      expect(result.eventLoop.microtasks.promises).toHaveLength(1);
    });

    it("loads sync outputs into consoleOutput", () => {
      const output = makeSyncOutput();

      const result = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [], syncOutputs: [output] },
      });

      expect(result.eventLoop.consoleOutput).toHaveLength(1);
      expect(result.eventLoop.consoleOutput[0].text).toBe("hello");
    });
  });

  // ── LOAD_CODE ─────────────────────────────────────────────────────

  describe("LOAD_CODE", () => {
    it("loads statements and sets code reading state", () => {
      const stmt = makeStatement();

      const result = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: { statements: [stmt], code: "console.log('test');" },
      });

      expect(result.eventLoop.codeStatements).toHaveLength(1);
      expect(result.eventLoop.codeReadIndex).toBe(-1);
      expect(result.eventLoop.codeFullyRead).toBe(false);
      expect(result.eventLoop.sourceCode).toBe("console.log('test');");
    });
  });

  // ── STEP_CODE ─────────────────────────────────────────────────────

  describe("STEP_CODE", () => {
    it("advances codeReadIndex and highlights lines", () => {
      const stmt = makeStatement({ startLine: 1, endLine: 2 });
      state = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: {
          statements: [stmt, makeStatement({ startLine: 3, endLine: 3 })],
          code: "x",
        },
      });

      const result = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(result.eventLoop.codeReadIndex).toBe(0);
      expect(result.eventLoop.highlightLines).toEqual({ start: 1, end: 2 });
    });

    it("enqueues task from statement into correct queue", () => {
      const task = makeTask({ phase: "timers" });
      const stmt = makeStatement({ task });
      state = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: { statements: [stmt], code: "x" },
      });

      const result = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(result.eventLoop.phaseQueues.timers).toHaveLength(1);
    });

    it("adds syncOutput from statement to console", () => {
      const syncOutput = makeSyncOutput();
      const stmt = makeStatement({ syncOutput });
      state = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: { statements: [stmt], code: "x" },
      });

      const result = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(result.eventLoop.consoleOutput).toHaveLength(1);
    });

    it("marks code as fully read after last statement", () => {
      const stmt = makeStatement();
      state = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: { statements: [stmt], code: "x" },
      });

      const result = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(result.eventLoop.codeFullyRead).toBe(true);
    });
  });

  // ── STEP (event loop execution) ───────────────────────────────────

  describe("STEP", () => {
    it("transitions from stopped to timers when work exists", () => {
      const task = makeTask();
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      const result = eventLoopReducer(state, { type: "STEP" });
      expect(result.eventLoop.currentPhase).toBe("timers");
    });

    it("finishes immediately when no work exists", () => {
      // No tasks loaded — step from stopped should finish
      const result = eventLoopReducer(state, { type: "STEP" });
      expect(result.eventLoop.finished).toBe(true);
    });

    it("executes a timer task and produces output", () => {
      const task = makeTask({ callback: "timer callback" });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // Step 2: execute timer
      state = eventLoopReducer(state, { type: "STEP" });

      expect(state.eventLoop.phaseQueues.timers).toHaveLength(0);
      expect(state.eventLoop.consoleOutput).toHaveLength(1);
      expect(state.eventLoop.consoleOutput[0].text).toBe("timer callback");
      expect(state.eventLoop.executionHistory).toHaveLength(1);
    });

    it("drains microtasks before macrotasks (nextTick priority)", () => {
      const nextTickTask = makeTask({
        id: "nt",
        type: "nextTick",
        phase: "microtask",
        callback: "nextTick cb",
      });
      const promiseTask = makeTask({
        id: "pr",
        type: "promise",
        phase: "microtask",
        callback: "promise cb",
      });
      const timerTask = makeTask({
        id: "tm",
        callback: "timer cb",
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: {
          tasks: [timerTask, nextTickTask, promiseTask],
          syncOutputs: [],
        },
      });

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // Step 2: should drain nextTick first (priority over promise)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[0].text).toBe("nextTick cb");
      expect(state.eventLoop.currentPhase).toBe("microtask");

      // Step 3: drain promise
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[1].text).toBe("promise cb");
    });

    it("advances phases in correct order", () => {
      // Load a task in "check" phase to keep loop alive
      const task = makeTask({
        id: "c1",
        type: "setImmediate",
        phase: "check",
        callback: "check cb",
      });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");

      // timers (empty) → pending
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("pending");

      // pending → idle
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("idle");

      // idle → poll
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("poll");

      // poll → check
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("check");

      // execute check task
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[0].text).toBe("check cb");
    });

    it("schedules children tasks when parent executes", () => {
      const child = makeTask({
        id: "child",
        type: "setImmediate",
        phase: "check",
        callback: "child cb",
      });
      const parent = makeTask({
        id: "parent",
        callback: "parent cb",
        children: [child],
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [parent], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // execute parent timer
      state = eventLoopReducer(state, { type: "STEP" });

      // child should now be in check queue
      expect(state.eventLoop.phaseQueues.check).toHaveLength(1);
      expect(state.eventLoop.phaseQueues.check[0].callback).toBe("child cb");
    });

    it("skips timers that are not yet ready (executeAtTick in the future)", () => {
      // Timer with high delay — should not execute on first tick
      const futureTimer = makeTask({
        id: "ft",
        delay: 500,
        executeAtTick: 50,
        callback: "future timer",
      });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [futureTimer], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");

      // timer not ready → should advance past timers (to pending)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("pending");
      // timer still in queue
      expect(state.eventLoop.phaseQueues.timers).toHaveLength(1);
    });

    it("wraps to a new iteration when all phases are exhausted but work remains", () => {
      // Timer far in the future — keeps loop alive but not executable yet
      const futureTimer = makeTask({
        id: "ft",
        delay: 500,
        executeAtTick: 50,
        callback: "future",
      });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [futureTimer], syncOutputs: [] },
      });

      // Walk through all 6 phases + stopped→timers = 7 steps
      for (let i = 0; i < 7; i++) {
        state = eventLoopReducer(state, { type: "STEP" });
      }
      // Should have wrapped to new iteration (iteration > 1)
      expect(state.eventLoop.currentIteration).toBeGreaterThan(0);
      expect(state.eventLoop.currentPhase).toBe("timers");
      expect(state.eventLoop.finished).toBe(false);
    });

    it("sets pollWaiting when entering poll phase with empty poll queue", () => {
      const task = makeTask({
        id: "c1",
        type: "setImmediate",
        phase: "check",
      });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      // Advance to poll phase: stopped→timers→pending→idle→poll = 4 steps
      for (let i = 0; i < 4; i++) {
        state = eventLoopReducer(state, { type: "STEP" });
      }
      expect(state.eventLoop.currentPhase).toBe("poll");
      expect(state.eventLoop.pollWaiting).toBe(true);
    });

    it("resumes the original phase after draining microtasks", () => {
      // Timer that spawns a nextTick child
      const child = makeTask({
        id: "nt_child",
        type: "nextTick",
        phase: "microtask",
        callback: "nextTick child",
      });
      const timer = makeTask({
        id: "timer",
        callback: "timer",
        children: [child],
      });
      // A second timer to keep work in the timers phase
      const timer2 = makeTask({
        id: "timer2",
        callback: "timer2",
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [timer, timer2], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // execute first timer (spawns nextTick child)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.microtasks.nextTick).toHaveLength(1);

      // drain nextTick microtask
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");

      // resume — should go back to timers (since timer2 is still there)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");
    });

    it("drains chained microtasks (microtask spawning microtask)", () => {
      const innerNextTick = makeTask({
        id: "inner_nt",
        type: "nextTick",
        phase: "microtask",
        callback: "inner nextTick",
      });
      const outerNextTick = makeTask({
        id: "outer_nt",
        type: "nextTick",
        phase: "microtask",
        callback: "outer nextTick",
        children: [innerNextTick],
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [outerNextTick], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // drain outer nextTick
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[0].text).toBe("outer nextTick");
      // inner nextTick should have been spawned
      expect(state.eventLoop.microtasks.nextTick).toHaveLength(1);

      // drain inner nextTick
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[1].text).toBe("inner nextTick");
    });

    it("STEP reads code first when code is not fully read", () => {
      const stmt = makeStatement({
        task: makeTask({ phase: "timers" }),
        source: "setTimeout(() => {}, 0);",
      });
      state = eventLoopReducer(state, {
        type: "LOAD_CODE",
        payload: { statements: [stmt], code: "setTimeout(() => {}, 0);" },
      });

      // STEP should act as stepCode when code not fully read
      const result = eventLoopReducer(state, { type: "STEP" });
      expect(result.eventLoop.codeReadIndex).toBe(0);
      expect(result.eventLoop.phaseQueues.timers).toHaveLength(1);
    });

    it("schedules child with delay relative to parent tick", () => {
      const child = makeTask({
        id: "child_delayed",
        type: "setTimeout",
        phase: "timers",
        callback: "child delayed",
        delay: 100,
        executeAtTick: 10,
      });
      const parent = makeTask({
        id: "parent",
        callback: "parent",
        children: [child],
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [parent], syncOutputs: [] },
      });

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      // execute parent (tick becomes 2)
      state = eventLoopReducer(state, { type: "STEP" });

      // child's executeAtTick = tick + child.delay = 2 + 100 = 102
      const scheduledChild = state.eventLoop.phaseQueues.timers[0];
      expect(scheduledChild.createdAtTick).toBe(2);
      expect(scheduledChild.executeAtTick).toBe(102);
    });

    it("executes poll phase tasks in FIFO order", () => {
      const poll1 = makeTask({
        id: "p1",
        type: "fs",
        phase: "poll",
        callback: "poll first",
      });
      const poll2 = makeTask({
        id: "p2",
        type: "fs",
        phase: "poll",
        callback: "poll second",
      });

      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [poll1, poll2], syncOutputs: [] },
      });

      // Advance to poll: stopped→timers→pending→idle→poll = 4 steps
      for (let i = 0; i < 4; i++) {
        state = eventLoopReducer(state, { type: "STEP" });
      }
      expect(state.eventLoop.currentPhase).toBe("poll");

      // Execute first poll task
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[0].text).toBe("poll first");

      // Execute second poll task
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.consoleOutput[1].text).toBe("poll second");
    });

    it("increments tick on each execution step", () => {
      const task = makeTask({ callback: "t" });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      expect(state.eventLoop.tick).toBe(0);
      // stopped → timers (tick 1)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.tick).toBe(1);
      // execute timer (tick 2)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.tick).toBe(2);
    });

    it("STEP_CODE is no-op when code is already fully read", () => {
      // Initial state has codeFullyRead: true by default
      const before = { ...state };
      const result = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(result.eventLoop.codeReadIndex).toBe(
        before.eventLoop.codeReadIndex,
      );
    });

    it("STEP is idempotent when already finished", () => {
      // No tasks → finishes immediately
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.finished).toBe(true);

      const before = { ...state };
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state).toEqual(before);
    });

    it("finishes when all work is complete", () => {
      const task = makeTask({ callback: "only task" });
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [task], syncOutputs: [] },
      });

      // Run until finished
      for (let i = 0; i < 20 && !state.eventLoop.finished; i++) {
        state = eventLoopReducer(state, { type: "STEP" });
      }

      expect(state.eventLoop.finished).toBe(true);
      expect(state.eventLoop.isRunning).toBe(false);
    });
  });

  // ── PLAY / PAUSE ──────────────────────────────────────────────────

  describe("PLAY", () => {
    it("sets isRunning to true and isPaused to false", () => {
      const result = eventLoopReducer(state, { type: "PLAY" });
      expect(result.eventLoop.isRunning).toBe(true);
      expect(result.eventLoop.isPaused).toBe(false);
    });
  });

  describe("PAUSE", () => {
    it("sets isPaused to true", () => {
      state = eventLoopReducer(state, { type: "PLAY" });
      const result = eventLoopReducer(state, { type: "PAUSE" });
      expect(result.eventLoop.isPaused).toBe(true);
    });
  });

  // ── RESET ─────────────────────────────────────────────────────────

  describe("RESET", () => {
    it("returns to initial state", () => {
      // Modify state first
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks: [makeTask()], syncOutputs: [makeSyncOutput()] },
      });
      state = eventLoopReducer(state, { type: "PLAY" });

      const result = eventLoopReducer(state, { type: "RESET" });
      expect(result.eventLoop.currentPhase).toBe("stopped");
      expect(result.eventLoop.isRunning).toBe(false);
      expect(result.eventLoop.consoleOutput).toEqual([]);
      expect(result.eventLoop.phaseQueues.timers).toEqual([]);
      expect(result.speed).toBe(1);
    });
  });

  // ── RESET_AND_LOAD_CODE ───────────────────────────────────────────

  describe("RESET_AND_LOAD_CODE", () => {
    it("resets and loads new code statements", () => {
      // Modify state first
      state = eventLoopReducer(state, { type: "PLAY" });

      const stmt = makeStatement();
      const result = eventLoopReducer(state, {
        type: "RESET_AND_LOAD_CODE",
        payload: { statements: [stmt], code: "code" },
      });

      expect(result.eventLoop.isRunning).toBe(false);
      expect(result.eventLoop.codeStatements).toHaveLength(1);
      expect(result.eventLoop.codeFullyRead).toBe(false);
      expect(result.eventLoop.sourceCode).toBe("code");
    });
  });

  // ── SET_SPEED ─────────────────────────────────────────────────────

  describe("SET_SPEED", () => {
    it("changes playback speed", () => {
      const result = eventLoopReducer(state, {
        type: "SET_SPEED",
        payload: 2,
      });
      expect(result.speed).toBe(2);
    });

    it("accepts all valid speed values", () => {
      for (const speed of [0.5, 1, 1.5, 2] as const) {
        const result = eventLoopReducer(state, {
          type: "SET_SPEED",
          payload: speed,
        });
        expect(result.speed).toBe(speed);
      }
    });
  });

  // ── Unknown action ────────────────────────────────────────────────

  describe("unknown action", () => {
    it("returns state unchanged", () => {
      const result = eventLoopReducer(state, { type: "UNKNOWN" } as never);
      expect(result).toEqual(state);
    });
  });
});
