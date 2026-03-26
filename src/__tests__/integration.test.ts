import { describe, it, expect, beforeEach } from "vitest";
import { parseCode, parseCodeToStatements } from "../utils/codeParser";
import { codeExamples } from "../data/examples";
import {
  createInitialState,
  eventLoopReducer,
  type ReducerState,
} from "../store/reducers/eventLoopReducer";
import { resetCounters } from "../store/reducers/helpers";

/**
 * Integration tests: parse real JS code, load into reducer,
 * step through each step and verify queue states, console output,
 * execution history, and call stack at every intermediate step.
 */

// ── Helpers ──────────────────────────────────────────────────────────────

/** Step the reducer N times and return the final state */
function stepN(state: ReducerState, n: number): ReducerState {
  for (let i = 0; i < n; i++) {
    state = eventLoopReducer(state, { type: "STEP" });
  }
  return state;
}

/** Run all steps to completion (safety limit 200) */
function runToCompletion(state: ReducerState): ReducerState {
  for (let i = 0; i < 200 && !state.eventLoop.finished; i++) {
    state = eventLoopReducer(state, { type: "STEP" });
  }
  return state;
}

/** Extract console output texts */
function consoleTexts(state: ReducerState): string[] {
  return state.eventLoop.consoleOutput.map((o) => o.text);
}

/** Extract execution history labels */
function historyLabels(state: ReducerState): string[] {
  return state.eventLoop.executionHistory.map((h) => h.label);
}

/** Snapshot of all queue lengths */
function queueLengths(state: ReducerState) {
  const q = state.eventLoop.phaseQueues;
  const m = state.eventLoop.microtasks;
  return {
    timers: q.timers.length,
    pending: q.pending.length,
    idle: q.idle.length,
    poll: q.poll.length,
    check: q.check.length,
    close: q.close.length,
    nextTick: m.nextTick.length,
    promises: m.promises.length,
  };
}

/** Load code via LOAD_TASKS (instant parse → load) and return state */
function loadFromCode(code: string): ReducerState {
  const { tasks, syncOutputs } = parseCode(code);
  let state = createInitialState();
  state = eventLoopReducer(state, {
    type: "LOAD_TASKS",
    payload: { tasks, syncOutputs },
  });
  return state;
}

/** Load code via LOAD_CODE (statement-by-statement reading) */
function loadCodeStatements(code: string): ReducerState {
  const { statements } = parseCodeToStatements(code);
  let state = createInitialState();
  state = eventLoopReducer(state, {
    type: "LOAD_CODE",
    payload: { statements, code },
  });
  return state;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: step-by-step event loop verification", () => {
  beforeEach(() => {
    resetCounters();
  });

  // ── 1. Basic console.log ─────────────────────────────────────────────

  describe("basic console.log", () => {
    it("sync output appears immediately on LOAD, all queues empty", () => {
      const state = loadFromCode("console.log('hello');");

      // Sync output should already be in consoleOutput after LOAD_TASKS
      expect(consoleTexts(state)).toEqual(["hello"]);

      // All queues should be empty — no async work
      const q = queueLengths(state);
      expect(q.timers).toBe(0);
      expect(q.nextTick).toBe(0);
      expect(q.promises).toBe(0);
      expect(q.check).toBe(0);
      expect(q.poll).toBe(0);

      // Call stack shows loaded message
      expect(state.eventLoop.callStack).toEqual([
        "Script loaded — press Step or Play",
      ]);
    });

    it("finishes immediately since no async work exists", () => {
      let state = loadFromCode("console.log('hello');");

      // Step → should finish (stopped, no work)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.finished).toBe(true);
      expect(consoleTexts(state)).toEqual(["hello"]);
      expect(state.eventLoop.executionHistory).toHaveLength(0);
    });
  });

  // ── 2. Sync before async ─────────────────────────────────────────────

  describe("sync code executes before async", () => {
    it("verifies queue states and output at each step", () => {
      const code = `
        console.log('start');
        setTimeout(() => console.log('timeout'), 0);
        console.log('end');
      `;
      let state = loadFromCode(code);

      // After LOAD: sync outputs already in console, timer in queue
      expect(consoleTexts(state)).toEqual(["start", "end"]);
      expect(queueLengths(state).timers).toBe(1);
      expect(state.eventLoop.executionHistory).toHaveLength(0);
      expect(state.eventLoop.currentPhase).toBe("stopped");

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");
      expect(state.eventLoop.callStack[0]).toContain("timers");
      expect(queueLengths(state).timers).toBe(1); // timer still in queue

      // Step 2: execute timer task
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["start", "end", "timeout"]);
      expect(queueLengths(state).timers).toBe(0); // timer drained
      expect(state.eventLoop.executionHistory).toHaveLength(1);
      expect(historyLabels(state)).toEqual(["timeout"]);

      // Finish
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
    });
  });

  // ── 3. nextTick has priority over Promise ────────────────────────────

  describe("nextTick executes before Promise", () => {
    it("verifies microtask queue fill, drain order, and outputs", () => {
      const code = `
        Promise.resolve().then(() => console.log('promise'));
        process.nextTick(() => console.log('nextTick'));
      `;
      let state = loadFromCode(code);

      // After LOAD: both microtask queues populated
      expect(queueLengths(state).nextTick).toBe(1);
      expect(queueLengths(state).promises).toBe(1);
      expect(consoleTexts(state)).toEqual([]); // no sync output

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");

      // Step 2: microtasks drain first — nextTick has priority
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");
      expect(consoleTexts(state)).toEqual(["nextTick"]);
      expect(queueLengths(state).nextTick).toBe(0); // nextTick drained
      expect(queueLengths(state).promises).toBe(1); // promise still waiting
      expect(state.eventLoop.callStack[0]).toContain("process.nextTick");
      expect(state.eventLoop.executionHistory).toHaveLength(1);

      // Step 3: drain promise microtask
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["nextTick", "promise"]);
      expect(queueLengths(state).promises).toBe(0); // promise drained
      expect(state.eventLoop.callStack[0]).toContain("Promise.then");
      expect(state.eventLoop.executionHistory).toHaveLength(2);

      // Finish
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
    });
  });

  // ── 4. Microtasks before macrotasks ──────────────────────────────────

  describe("microtasks execute before macrotasks", () => {
    it("nextTick drains before timer, queues verified", () => {
      const code = `
        setTimeout(() => console.log('timeout'), 0);
        process.nextTick(() => console.log('nextTick'));
      `;
      let state = loadFromCode(code);

      // After LOAD: timer in timers queue, nextTick in microtask queue
      expect(queueLengths(state).timers).toBe(1);
      expect(queueLengths(state).nextTick).toBe(1);

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");

      // Step 2: nextTick microtask drains first (not the timer!)
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");
      expect(consoleTexts(state)).toEqual(["nextTick"]);
      expect(queueLengths(state).nextTick).toBe(0);
      expect(queueLengths(state).timers).toBe(1); // timer still waiting

      // Step 3: resume to timers after microtask drain
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");

      // Step 4: execute timer
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["nextTick", "timeout"]);
      expect(queueLengths(state).timers).toBe(0);
      expect(state.eventLoop.executionHistory).toHaveLength(2);
    });
  });

  // ── 5. setTimeout vs setImmediate ────────────────────────────────────

  describe("setImmediate runs in check phase", () => {
    it("verifies both land in correct queues and both execute", () => {
      const code = `
        setTimeout(() => console.log('timeout'), 0);
        setImmediate(() => console.log('immediate'));
      `;
      let state = loadFromCode(code);

      // After LOAD: timer in timers, immediate in check
      expect(queueLengths(state).timers).toBe(1);
      expect(queueLengths(state).check).toBe(1);

      // Run to completion
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
      expect(consoleTexts(state)).toContain("timeout");
      expect(consoleTexts(state)).toContain("immediate");
      expect(state.eventLoop.executionHistory).toHaveLength(2);
    });
  });

  // ── 6. Complex example: full step-by-step ────────────────────────────

  describe("complex example: full step-by-step verification", () => {
    it("verifies queues, console, callStack, executionHistory at every step", () => {
      const code = `
        console.log('start');
        setTimeout(() => console.log('timeout'), 0);
        Promise.resolve().then(() => console.log('promise'));
        process.nextTick(() => console.log('nextTick'));
        console.log('end');
      `;
      let state = loadFromCode(code);

      // === After LOAD_TASKS ===
      expect(consoleTexts(state)).toEqual(["start", "end"]);
      expect(queueLengths(state)).toEqual({
        timers: 1,
        pending: 0,
        idle: 0,
        poll: 0,
        check: 0,
        close: 0,
        nextTick: 1,
        promises: 1,
      });
      expect(state.eventLoop.currentPhase).toBe("stopped");
      expect(state.eventLoop.executionHistory).toHaveLength(0);

      // === Step 1: stopped → timers ===
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");
      expect(state.eventLoop.callStack[0]).toContain("timers");
      expect(consoleTexts(state)).toEqual(["start", "end"]); // no change
      expect(state.eventLoop.executionHistory).toHaveLength(0);

      // === Step 2: drain nextTick microtask (priority over promise) ===
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");
      expect(consoleTexts(state)).toEqual(["start", "end", "nextTick"]);
      expect(queueLengths(state).nextTick).toBe(0);
      expect(queueLengths(state).promises).toBe(1); // promise still queued
      expect(state.eventLoop.callStack[0]).toContain("process.nextTick");
      expect(state.eventLoop.executionHistory).toHaveLength(1);

      // === Step 3: drain promise microtask ===
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");
      expect(consoleTexts(state)).toEqual([
        "start",
        "end",
        "nextTick",
        "promise",
      ]);
      expect(queueLengths(state).promises).toBe(0);
      expect(state.eventLoop.callStack[0]).toContain("Promise.then");
      expect(state.eventLoop.executionHistory).toHaveLength(2);

      // === Step 4: resume from microtask → back to timers ===
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");
      expect(queueLengths(state).timers).toBe(1); // timer still there
      expect(consoleTexts(state).length).toBe(4); // no new output

      // === Step 5: execute timer ===
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual([
        "start",
        "end",
        "nextTick",
        "promise",
        "timeout",
      ]);
      expect(queueLengths(state).timers).toBe(0); // timer drained
      expect(state.eventLoop.executionHistory).toHaveLength(3);
      expect(historyLabels(state)[2]).toBe("timeout");

      // === Run to finish ===
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
      expect(state.eventLoop.isRunning).toBe(false);
    });
  });

  // ── 7. Nested callbacks: I/O → setImmediate + setTimeout ─────────────

  describe("nested callbacks: I/O spawns timer and immediate", () => {
    it("verifies child tasks enqueued after parent executes", () => {
      const code = `
        fs.readFile('file.txt', () => {
          console.log('file read');
          setImmediate(() => console.log('immediate in IO'));
          setTimeout(() => console.log('timeout in IO'), 0);
        });
      `;
      let state = loadFromCode(code);

      // After LOAD: fs task in poll queue
      expect(queueLengths(state).poll).toBe(1);
      expect(queueLengths(state).check).toBe(0);
      expect(queueLengths(state).timers).toBe(0);

      // Advance to poll phase: stopped→timers→pending→idle→poll = 4 steps
      state = stepN(state, 4);
      expect(state.eventLoop.currentPhase).toBe("poll");

      // Execute poll task (fs.readFile callback) — children appear
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["file read"]);
      expect(queueLengths(state).poll).toBe(0); // parent drained
      expect(queueLengths(state).check).toBe(1); // setImmediate child
      expect(queueLengths(state).timers).toBe(1); // setTimeout child
      expect(state.eventLoop.executionHistory).toHaveLength(1);

      // Advance to check phase: poll→check
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("check");

      // Execute setImmediate
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["file read", "immediate in IO"]);
      expect(queueLengths(state).check).toBe(0); // immediate drained

      // Run to completion — setTimeout should also fire
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
      expect(consoleTexts(state)).toEqual([
        "file read",
        "immediate in IO",
        "timeout in IO",
      ]);

      // setImmediate before setTimeout (check phase before timers in next iteration)
      const immIdx = consoleTexts(state).indexOf("immediate in IO");
      const timeIdx = consoleTexts(state).indexOf("timeout in IO");
      expect(immIdx).toBeLessThan(timeIdx);
    });
  });

  // ── 8. Chained microtasks ────────────────────────────────────────────

  describe("chained microtasks drain fully", () => {
    it("child microtask appears in queue after parent executes, then drains", () => {
      const code = `
        process.nextTick(() => {
          console.log('nextTick 1');
          process.nextTick(() => console.log('nextTick 2'));
        });
      `;
      let state = loadFromCode(code);

      // After LOAD: one nextTick in queue
      expect(queueLengths(state).nextTick).toBe(1);

      // Step 1: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });

      // Step 2: drain parent nextTick → child appears
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("microtask");
      expect(consoleTexts(state)).toEqual(["nextTick 1"]);
      expect(queueLengths(state).nextTick).toBe(1); // child spawned
      expect(state.eventLoop.executionHistory).toHaveLength(1);

      // Step 3: drain child nextTick
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["nextTick 1", "nextTick 2"]);
      expect(queueLengths(state).nextTick).toBe(0); // fully drained
      expect(state.eventLoop.executionHistory).toHaveLength(2);

      // Finish
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
    });
  });

  // ── 9. Mixed operations with full queue tracking ─────────────────────

  describe("mixed operations: full queue lifecycle", () => {
    it("tracks all queues through the entire execution", () => {
      const code = `
        console.log('start');
        setTimeout(() => console.log('timeout 1'), 0);
        setImmediate(() => {
          console.log('immediate 1');
          process.nextTick(() => console.log('nextTick in immediate'));
        });
        Promise.resolve().then(() => {
          console.log('promise 1');
          Promise.resolve().then(() => console.log('promise 2'));
        });
        process.nextTick(() => {
          console.log('nextTick 1');
          process.nextTick(() => console.log('nextTick 2'));
        });
        console.log('end');
      `;
      let state = loadFromCode(code);

      // === After LOAD ===
      expect(consoleTexts(state)).toEqual(["start", "end"]);
      expect(queueLengths(state)).toEqual({
        timers: 1, // setTimeout
        pending: 0,
        idle: 0,
        poll: 0,
        check: 1, // setImmediate
        close: 0,
        nextTick: 1, // process.nextTick
        promises: 1, // Promise.then
      });

      // Run to completion and verify final order
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);

      const output = consoleTexts(state);
      // Sync first
      expect(output[0]).toBe("start");
      expect(output[1]).toBe("end");

      // nextTick before promise (both sets)
      expect(output[2]).toBe("nextTick 1");
      expect(output[3]).toBe("nextTick 2");
      expect(output[4]).toBe("promise 1");
      expect(output[5]).toBe("promise 2");

      // All macro tasks execute
      expect(output).toContain("timeout 1");
      expect(output).toContain("immediate 1");
      expect(output).toContain("nextTick in immediate");

      // All queues empty at the end
      const endQueues = queueLengths(state);
      expect(endQueues.timers).toBe(0);
      expect(endQueues.check).toBe(0);
      expect(endQueues.nextTick).toBe(0);
      expect(endQueues.promises).toBe(0);
    });
  });

  // ── 10. Console Output verification ──────────────────────────────────

  describe("🖥 Console Output", () => {
    it("each console output has correct phase and taskType metadata", () => {
      const code = `
        console.log('sync');
        process.nextTick(() => console.log('tick'));
        Promise.resolve().then(() => console.log('prom'));
        setTimeout(() => console.log('timer'), 0);
      `;
      let state = loadFromCode(code);

      // Sync output from LOAD
      expect(state.eventLoop.consoleOutput[0].text).toBe("sync");
      expect(state.eventLoop.consoleOutput[0].phase).toBe("sync");
      expect(state.eventLoop.consoleOutput[0].taskType).toBe("sync");

      // Run to completion
      state = runToCompletion(state);

      const outputs = state.eventLoop.consoleOutput;

      // Find microtask outputs
      const tickOut = outputs.find((o) => o.text === "tick")!;
      expect(tickOut.phase).toBe("microtask");
      expect(tickOut.taskType).toBe("nextTick");

      const promOut = outputs.find((o) => o.text === "prom")!;
      expect(promOut.phase).toBe("microtask");
      expect(promOut.taskType).toBe("promise");

      // Timer output
      const timerOut = outputs.find((o) => o.text === "timer")!;
      expect(timerOut.phase).toBe("timers");
      expect(timerOut.taskType).toBe("setTimeout");
    });

    it("console output accumulates correctly across steps", () => {
      const code = `
        console.log('a');
        setTimeout(() => console.log('b'), 0);
        process.nextTick(() => console.log('c'));
      `;
      let state = loadFromCode(code);

      // After LOAD: only sync
      expect(consoleTexts(state)).toEqual(["a"]);

      // Step through: stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["a"]); // still just sync

      // nextTick drains
      state = eventLoopReducer(state, { type: "STEP" });
      expect(consoleTexts(state)).toEqual(["a", "c"]);

      // Resume and execute timer
      state = runToCompletion(state);
      expect(consoleTexts(state)).toEqual(["a", "c", "b"]);
    });
  });

  // ── 11. Execution Log verification ───────────────────────────────────

  describe("📋 Execution Log", () => {
    it("execution history grows with each task execution", () => {
      const code = `
        setTimeout(() => console.log('t1'), 0);
        process.nextTick(() => console.log('nt1'));
      `;
      let state = loadFromCode(code);
      expect(state.eventLoop.executionHistory).toHaveLength(0);

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.executionHistory).toHaveLength(0); // phase transition, no execution

      // drain nextTick
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.executionHistory).toHaveLength(1);
      const histItem = state.eventLoop.executionHistory[0];
      expect(histItem.phase).toBe("microtask");
      expect(histItem.taskType).toBe("nextTick");
      expect(histItem.label).toBe("nt1");

      // resume and execute timer
      state = eventLoopReducer(state, { type: "STEP" }); // resume timers
      state = eventLoopReducer(state, { type: "STEP" }); // execute timer
      expect(state.eventLoop.executionHistory).toHaveLength(2);
      expect(state.eventLoop.executionHistory[1].phase).toBe("timers");
      expect(state.eventLoop.executionHistory[1].taskType).toBe("setTimeout");
    });

    it("history items have unique IDs and correct iteration", () => {
      const code = `
        setTimeout(() => console.log('t1'), 0);
        setImmediate(() => console.log('i1'));
      `;
      let state = loadFromCode(code);
      state = runToCompletion(state);

      const history = state.eventLoop.executionHistory;
      expect(history.length).toBeGreaterThanOrEqual(2);

      // All IDs unique
      const ids = history.map((h) => h.id);
      expect(new Set(ids).size).toBe(ids.length);

      // All have valid tick values
      for (const item of history) {
        expect(item.tick).toBeGreaterThan(0);
      }
    });
  });

  // ── 12. Call Stack verification ──────────────────────────────────────

  describe("📚 Call Stack", () => {
    it("callStack shows phase transitions during traversal", () => {
      const code = `
        setImmediate(() => console.log('imm'));
      `;
      let state = loadFromCode(code);

      // Initial: loaded message
      expect(state.eventLoop.callStack).toEqual([
        "Script loaded — press Step or Play",
      ]);

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("timers");

      // timers → pending
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("pending");

      // pending → idle
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("idle");

      // idle → poll
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("poll");

      // poll → check
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("check");

      // execute setImmediate — callStack shows task type
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("setImmediate");
    });

    it("callStack shows microtask labels correctly", () => {
      const code = `
        process.nextTick(() => console.log('nt'));
        Promise.resolve().then(() => console.log('pr'));
      `;
      let state = loadFromCode(code);

      // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" });

      // drain nextTick
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("process.nextTick");

      // drain promise
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.callStack[0]).toContain("Promise.then");
    });

    it("callStack is empty when finished", () => {
      const code = `setTimeout(() => console.log('t'), 0);`;
      let state = loadFromCode(code);
      state = runToCompletion(state);
      expect(state.eventLoop.callStack).toEqual([]);
    });
  });

  // ── 13. LOAD_CODE + STEP_CODE flow ──────────────────────────────────

  describe("LOAD_CODE + STEP_CODE: statement-by-statement reading", () => {
    it("reads code line by line, queues fill progressively", () => {
      const code = `console.log('hello');
setTimeout(() => console.log('timeout'), 0);
process.nextTick(() => console.log('tick'));`;

      let state = loadCodeStatements(code);

      // Initial state: code not read yet
      expect(state.eventLoop.codeReadIndex).toBe(-1);
      expect(state.eventLoop.codeFullyRead).toBe(false);
      expect(state.eventLoop.codeStatements.length).toBe(3);
      expect(state.eventLoop.callStack[0]).toContain("Script loaded");
      expect(queueLengths(state).timers).toBe(0);
      expect(queueLengths(state).nextTick).toBe(0);

      // Step 1 (STEP_CODE): read console.log('hello')
      state = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(state.eventLoop.codeReadIndex).toBe(0);
      expect(state.eventLoop.highlightLines).toEqual({ start: 1, end: 1 });
      expect(consoleTexts(state)).toEqual(["hello"]); // sync output
      expect(queueLengths(state).timers).toBe(0); // no async yet
      expect(state.eventLoop.callStack[0]).toContain("Reading:");

      // Step 2 (STEP_CODE): read setTimeout
      state = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(state.eventLoop.codeReadIndex).toBe(1);
      expect(queueLengths(state).timers).toBe(1); // timer enqueued
      expect(queueLengths(state).nextTick).toBe(0); // nextTick not yet

      // Step 3 (STEP_CODE): read process.nextTick — code fully read
      state = eventLoopReducer(state, { type: "STEP_CODE" });
      expect(state.eventLoop.codeReadIndex).toBe(2);
      expect(state.eventLoop.codeFullyRead).toBe(true);
      expect(queueLengths(state).nextTick).toBe(1); // nextTick enqueued
      expect(state.eventLoop.callStack[0]).toContain("fully read");
    });

    it("STEP auto-delegates to STEP_CODE when code is not fully read", () => {
      const code = `setTimeout(() => console.log('t'), 0);`;
      let state = loadCodeStatements(code);

      // STEP should behave as STEP_CODE
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.codeReadIndex).toBe(0);
      expect(state.eventLoop.codeFullyRead).toBe(true);
      expect(queueLengths(state).timers).toBe(1);

      // Next STEP should execute event loop
      state = eventLoopReducer(state, { type: "STEP" });
      expect(state.eventLoop.currentPhase).toBe("timers");
    });

    it("full flow: read code → execute event loop → finish", () => {
      const code = `console.log('sync');
setTimeout(() => console.log('async'), 0);`;

      let state = loadCodeStatements(code);

      // Read all statements
      state = eventLoopReducer(state, { type: "STEP" }); // read console.log
      expect(consoleTexts(state)).toEqual(["sync"]);
      state = eventLoopReducer(state, { type: "STEP" }); // read setTimeout
      expect(state.eventLoop.codeFullyRead).toBe(true);
      expect(queueLengths(state).timers).toBe(1);

      // Execute event loop
      state = eventLoopReducer(state, { type: "STEP" }); // stopped → timers
      state = eventLoopReducer(state, { type: "STEP" }); // execute timer
      expect(consoleTexts(state)).toEqual(["sync", "async"]);
      expect(state.eventLoop.executionHistory).toHaveLength(1);

      // Finish
      state = runToCompletion(state);
      expect(state.eventLoop.finished).toBe(true);
    });
  });

  // ── 14. Phase transition completeness ────────────────────────────────

  describe("phase transitions", () => {
    it("traverses all 6 phases in correct order", () => {
      const code = `setImmediate(() => console.log('check'));`;
      let state = loadFromCode(code);

      const phases: string[] = [];

      // stopped → timers → pending → idle → poll → check → execute
      for (let i = 0; i < 6; i++) {
        state = eventLoopReducer(state, { type: "STEP" });
        phases.push(state.eventLoop.currentPhase);
      }

      expect(phases).toEqual([
        "timers",
        "pending",
        "idle",
        "poll",
        "check",
        "check", // still in check, executing the task
      ]);
    });
  });

  // ── 15. All examples from codeExamples ───────────────────────────────

  describe("all codeExamples complete without infinite loop", () => {
    it("finishes and all queues empty", () => {
      for (const example of codeExamples) {
        const state = loadFromCode(example.code);
        const finished = runToCompletion(state);
        expect(finished.eventLoop.finished).toBe(true);

        // All queues should be empty at the end
        const q = queueLengths(finished);
        expect(q.timers).toBe(0);
        expect(q.nextTick).toBe(0);
        expect(q.promises).toBe(0);
        expect(q.check).toBe(0);
        expect(q.poll).toBe(0);
      }
    });
  });
});
