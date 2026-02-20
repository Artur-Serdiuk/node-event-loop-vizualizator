import { describe, it, expect } from "vitest";
import { parseCode } from "../utils/codeParser";
import { codeExamples } from "../data/examples";
import {
  createInitialState,
  eventLoopReducer,
  type ReducerState,
} from "../store/reducers/eventLoopReducer";

/**
 * Integration tests: parse real JS code, load into reducer,
 * step through until finished, and verify final console output order.
 */

/** Run a code snippet through the full pipeline and return console output texts */
function runToCompletion(code: string): string[] {
  const { tasks, syncOutputs } = parseCode(code);
  let state: ReducerState = createInitialState();

  state = eventLoopReducer(state, {
    type: "LOAD_TASKS",
    payload: { tasks, syncOutputs },
  });

  // Step through event loop until finished (max 200 steps as safety)
  for (let i = 0; i < 200 && !state.eventLoop.finished; i++) {
    state = eventLoopReducer(state, { type: "STEP" });
  }

  return state.eventLoop.consoleOutput.map((o) => o.text);
}

describe("Integration: parseCode → reducer → output", () => {
  it("basic console.log", () => {
    const output = runToCompletion("console.log('hello');");
    expect(output).toEqual(["hello"]);
  });

  it("sync code executes before async", () => {
    const code = `
      console.log('start');
      setTimeout(() => console.log('timeout'), 0);
      console.log('end');
    `;
    const output = runToCompletion(code);
    expect(output[0]).toBe("start");
    expect(output[1]).toBe("end");
    expect(output[2]).toBe("timeout");
  });

  it("nextTick executes before Promise", () => {
    const code = `
      Promise.resolve().then(() => console.log('promise'));
      process.nextTick(() => console.log('nextTick'));
    `;
    const output = runToCompletion(code);
    expect(output[0]).toBe("nextTick");
    expect(output[1]).toBe("promise");
  });

  it("microtasks execute before macrotasks", () => {
    const code = `
      setTimeout(() => console.log('timeout'), 0);
      process.nextTick(() => console.log('nextTick'));
    `;
    const output = runToCompletion(code);
    expect(output[0]).toBe("nextTick");
    expect(output[1]).toBe("timeout");
  });

  it("setImmediate runs in check phase (after poll)", () => {
    const code = `
      setTimeout(() => console.log('timeout'), 0);
      setImmediate(() => console.log('immediate'));
    `;
    const output = runToCompletion(code);
    // Both should be in output
    expect(output).toContain("timeout");
    expect(output).toContain("immediate");
  });

  it("complex example: correct execution order", () => {
    const code = `
      console.log('start');
      setTimeout(() => console.log('timeout'), 0);
      Promise.resolve().then(() => console.log('promise'));
      process.nextTick(() => console.log('nextTick'));
      console.log('end');
    `;
    const output = runToCompletion(code);
    // Sync: start, end
    expect(output[0]).toBe("start");
    expect(output[1]).toBe("end");
    // Microtasks: nextTick before promise
    expect(output[2]).toBe("nextTick");
    expect(output[3]).toBe("promise");
    // Macrotask: timeout last
    expect(output[4]).toBe("timeout");
  });

  it("nested callbacks: I/O spawns timer and immediate", () => {
    const code = `
      fs.readFile('file.txt', () => {
        console.log('file read');
        setImmediate(() => console.log('immediate in IO'));
        setTimeout(() => console.log('timeout in IO'), 0);
      });
    `;
    const output = runToCompletion(code);
    expect(output[0]).toBe("file read");
    // setImmediate (check) should come before setTimeout (timers on next iteration)
    const immIdx = output.indexOf("immediate in IO");
    const timeIdx = output.indexOf("timeout in IO");
    expect(immIdx).toBeLessThan(timeIdx);
  });

  it("chained microtasks drain fully", () => {
    const code = `
      process.nextTick(() => {
        console.log('nextTick 1');
        process.nextTick(() => console.log('nextTick 2'));
      });
    `;
    const output = runToCompletion(code);
    expect(output[0]).toBe("nextTick 1");
    expect(output[1]).toBe("nextTick 2");
  });

  it("mixed operations example from data/examples", () => {
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
    const output = runToCompletion(code);

    // Sync first
    expect(output[0]).toBe("start");
    expect(output[1]).toBe("end");

    // nextTick before promise
    expect(output[2]).toBe("nextTick 1");
    expect(output[3]).toBe("nextTick 2");
    expect(output[4]).toBe("promise 1");
    expect(output[5]).toBe("promise 2");

    // Then macrotasks run
    expect(output).toContain("timeout 1");
    expect(output).toContain("immediate 1");
    expect(output).toContain("nextTick in immediate");
  });

  it("all examples from codeExamples complete without infinite loop", () => {
    for (const example of codeExamples) {
      const { tasks, syncOutputs } = parseCode(example.code);
      let state = createInitialState();
      state = eventLoopReducer(state, {
        type: "LOAD_TASKS",
        payload: { tasks, syncOutputs },
      });

      let steps = 0;
      while (!state.eventLoop.finished && steps < 200) {
        state = eventLoopReducer(state, { type: "STEP" });
        steps++;
      }
      expect(state.eventLoop.finished).toBe(true);
    }
  });
});
