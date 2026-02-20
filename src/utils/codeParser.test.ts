import { describe, it, expect } from "vitest";
import { parseCode, parseCodeToStatements } from "./codeParser";

describe("codeParser", () => {
  // ── parseCode ───────────────────────────────────────────────────────

  describe("parseCode", () => {
    describe("edge cases", () => {
      it("returns empty results for empty string", () => {
        const result = parseCode("");
        expect(result.tasks).toEqual([]);
        expect(result.syncOutputs).toEqual([]);
        expect(result.errors).toEqual([]);
      });

      it("returns a syntax error for invalid JavaScript", () => {
        const result = parseCode("const x = {{{;");
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.tasks).toEqual([]);
        expect(result.syncOutputs).toEqual([]);
      });

      it("ignores unknown function calls", () => {
        const result = parseCode("someFunction();");
        expect(result.tasks).toEqual([]);
        expect(result.syncOutputs).toEqual([]);
        expect(result.errors).toEqual([]);
      });
    });

    // ── console.log ─────────────────────────────────────────────────

    describe("console.log (sync output)", () => {
      it("extracts string literal from console.log", () => {
        const result = parseCode("console.log('hello');");
        expect(result.syncOutputs).toHaveLength(1);
        expect(result.syncOutputs[0].text).toBe("hello");
        expect(result.syncOutputs[0].phase).toBe("sync");
        expect(result.syncOutputs[0].taskType).toBe("sync");
      });

      it("extracts multiple console.log calls", () => {
        const code = `console.log('first');\nconsole.log('second');`;
        const result = parseCode(code);
        expect(result.syncOutputs).toHaveLength(2);
        expect(result.syncOutputs[0].text).toBe("first");
        expect(result.syncOutputs[1].text).toBe("second");
      });

      it("generates unique ids for each output", () => {
        const code = `console.log('a');\nconsole.log('b');`;
        const result = parseCode(code);
        expect(result.syncOutputs[0].id).not.toBe(result.syncOutputs[1].id);
      });
    });

    // ── setTimeout ──────────────────────────────────────────────────

    describe("setTimeout", () => {
      it("creates a task with correct type and phase", () => {
        const result = parseCode("setTimeout(() => console.log('hi'), 100);");
        expect(result.tasks).toHaveLength(1);

        const task = result.tasks[0];
        expect(task.type).toBe("setTimeout");
        expect(task.phase).toBe("timers");
        expect(task.delay).toBe(100);
      });

      it("handles zero delay", () => {
        const result = parseCode("setTimeout(() => console.log('now'), 0);");
        const task = result.tasks[0];
        expect(task.delay).toBe(0);
        expect(task.executeAtTick).toBe(0);
      });

      it("extracts callback label from console.log inside", () => {
        const result = parseCode(
          "setTimeout(() => console.log('timeout'), 50);",
        );
        const task = result.tasks[0];
        expect(task.callback).toBe("timeout");
      });

      it("calculates executeAtTick using delayToTicks", () => {
        const result = parseCode("setTimeout(() => console.log('x'), 100);");
        const task = result.tasks[0];
        // delayToTicks(100) = Math.max(1, Math.ceil(100/10)) = 10
        expect(task.executeAtTick).toBe(10);
      });
    });

    // ── setImmediate ────────────────────────────────────────────────

    describe("setImmediate", () => {
      it("creates a task with correct type and phase", () => {
        const result = parseCode("setImmediate(() => console.log('imm'));");
        expect(result.tasks).toHaveLength(1);

        const task = result.tasks[0];
        expect(task.type).toBe("setImmediate");
        expect(task.phase).toBe("check");
        expect(task.delay).toBeUndefined();
      });
    });

    // ── process.nextTick ────────────────────────────────────────────

    describe("process.nextTick", () => {
      it("creates a microtask with type nextTick", () => {
        const result = parseCode(
          "process.nextTick(() => console.log('tick'));",
        );
        expect(result.tasks).toHaveLength(1);

        const task = result.tasks[0];
        expect(task.type).toBe("nextTick");
        expect(task.phase).toBe("microtask");
      });
    });

    // ── Promise.resolve().then ──────────────────────────────────────

    describe("Promise.resolve().then", () => {
      it("creates a microtask with type promise", () => {
        const result = parseCode(
          "Promise.resolve().then(() => console.log('resolved'));",
        );
        expect(result.tasks).toHaveLength(1);

        const task = result.tasks[0];
        expect(task.type).toBe("promise");
        expect(task.phase).toBe("microtask");
      });
    });

    // ── fs.readFile ─────────────────────────────────────────────────

    describe("fs operations", () => {
      it("creates a task for fs.readFile in poll phase", () => {
        const result = parseCode(
          "fs.readFile('file.txt', () => console.log('read'));",
        );
        expect(result.tasks).toHaveLength(1);

        const task = result.tasks[0];
        expect(task.type).toBe("fs");
        expect(task.phase).toBe("poll");
      });

      it("creates a task for fs.writeFile in poll phase", () => {
        const result = parseCode(
          "fs.writeFile('file.txt', 'data', () => console.log('written'));",
        );
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].type).toBe("fs");
        expect(result.tasks[0].phase).toBe("poll");
      });
    });

    // ── Nested callbacks (children) ─────────────────────────────────

    describe("nested callbacks", () => {
      it("parses nested tasks as children", () => {
        const code = `fs.readFile('file.txt', () => {
          console.log('read');
          setTimeout(() => console.log('nested timeout'), 0);
        });`;
        const result = parseCode(code);
        expect(result.tasks).toHaveLength(1);

        const parent = result.tasks[0];
        expect(parent.children).toBeDefined();
        expect(parent.children!.length).toBe(1);
        expect(parent.children![0].type).toBe("setTimeout");
        expect(parent.children![0].phase).toBe("timers");
      });

      it("handles multiple nested tasks", () => {
        const code = `fs.readFile('file.txt', () => {
          setImmediate(() => console.log('immediate'));
          setTimeout(() => console.log('timeout'), 0);
        });`;
        const result = parseCode(code);
        const parent = result.tasks[0];
        expect(parent.children).toHaveLength(2);
      });
    });

    // ── delayToTicks edge cases ──────────────────────────────────────

    describe("delayToTicks calculation", () => {
      it("maps small delays (1-10ms) to tick 1", () => {
        const result = parseCode("setTimeout(() => console.log('x'), 5);");
        // delayToTicks(5) = Math.max(1, Math.ceil(5/10)) = 1
        expect(result.tasks[0].executeAtTick).toBe(1);
      });

      it("maps negative or zero delay to tick 0", () => {
        const result = parseCode("setTimeout(() => console.log('x'), 0);");
        expect(result.tasks[0].executeAtTick).toBe(0);
      });

      it("maps large delay correctly", () => {
        const result = parseCode("setTimeout(() => console.log('x'), 1000);");
        // delayToTicks(1000) = Math.max(1, Math.ceil(1000/10)) = 100
        expect(result.tasks[0].executeAtTick).toBe(100);
      });
    });

    // ── console.log edge cases ──────────────────────────────────────

    describe("console.log edge cases", () => {
      it("handles console.log with variable argument (not literal)", () => {
        const result = parseCode("console.log(someVar);");
        expect(result.syncOutputs).toHaveLength(1);
        // Falls back to extracting source text
        expect(result.syncOutputs[0].text).toBeTruthy();
      });

      it("does NOT create sync output for console.log inside callbacks", () => {
        const code = "setTimeout(() => { console.log('inner'); }, 0);";
        const result = parseCode(code);
        // The console.log is inside a callback — no sync output
        expect(result.syncOutputs).toHaveLength(0);
        // But the task should extract the label from it
        expect(result.tasks[0].callback).toBe("inner");
      });
    });

    // ── Callback label extraction ───────────────────────────────────

    describe("callback label extraction", () => {
      it("joins multiple console.log in a callback with semicolons", () => {
        const code = `setTimeout(() => {
          console.log('a');
          console.log('b');
        }, 0);`;
        const result = parseCode(code);
        expect(result.tasks[0].callback).toBe("a; b");
      });

      it("handles arrow expression body () => console.log(...)", () => {
        const code = "setImmediate(() => console.log('arrow'));";
        const result = parseCode(code);
        expect(result.tasks[0].callback).toBe("arrow");
      });
    });

    // ── Callback without console.log (label fallback) ───────────────

    describe("callback without console.log (label fallback)", () => {
      it("falls back to source substring when no console.log in callback", () => {
        const code = "setTimeout(() => { doSomething(); }, 100);";
        const result = parseCode(code);
        // Should use first 60 chars of callback source as label
        expect(result.tasks[0].callback).toBeTruthy();
        expect(result.tasks[0].callback).not.toBe("setTimeout callback");
      });

      it("truncates long callback source to 60 chars", () => {
        // Build a callback with body longer than 60 chars
        const longBody = "a".repeat(100);
        const code = `setTimeout(() => { const ${longBody} = 1; }, 0);`;
        const result = parseCode(code);
        expect(result.tasks[0].callback.length).toBeLessThanOrEqual(60);
      });
    });

    // ── setTimeout without delay argument ───────────────────────────

    describe("setTimeout without explicit delay", () => {
      it("defaults to delay 0 when no second argument", () => {
        const result = parseCode("setTimeout(() => console.log('x'));");
        const task = result.tasks[0];
        expect(task.delay).toBe(0);
        expect(task.executeAtTick).toBe(0);
      });
    });

    // ── Multiple top-level statements ───────────────────────────────

    describe("multiple statements", () => {
      it("parses mixed sync and async operations", () => {
        const code = `console.log('start');
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
console.log('end');`;

        const result = parseCode(code);
        expect(result.syncOutputs).toHaveLength(2);
        expect(result.syncOutputs[0].text).toBe("start");
        expect(result.syncOutputs[1].text).toBe("end");
        expect(result.tasks).toHaveLength(2);
      });

      it("assigns unique ids to all tasks", () => {
        const code = `setTimeout(() => console.log('a'), 0);
setTimeout(() => console.log('b'), 0);
setImmediate(() => console.log('c'));`;

        const result = parseCode(code);
        const ids = result.tasks.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  });

  // ── parseCodeToStatements ───────────────────────────────────────────

  describe("parseCodeToStatements", () => {
    it("returns an error for invalid code", () => {
      const result = parseCodeToStatements("}{invalid");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.statements).toEqual([]);
    });

    it("splits code into statements with line info", () => {
      const code = `console.log('hello');\nsetTimeout(() => console.log('x'), 0);`;
      const result = parseCodeToStatements(code);

      expect(result.statements).toHaveLength(2);
      expect(result.statements[0].startLine).toBe(1);
      expect(result.statements[0].endLine).toBe(1);
      expect(result.statements[1].startLine).toBe(2);
    });

    it("attaches task to async statement", () => {
      const code = "setTimeout(() => console.log('timer'), 100);";
      const result = parseCodeToStatements(code);

      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].task).toBeDefined();
      expect(result.statements[0].task!.type).toBe("setTimeout");
    });

    it("attaches syncOutput to console.log statement", () => {
      const code = "console.log('sync');";
      const result = parseCodeToStatements(code);

      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].syncOutput).toBeDefined();
      expect(result.statements[0].syncOutput!.text).toBe("sync");
    });

    it("handles multiline statement correctly", () => {
      const code = `setTimeout(() => {
  console.log('multi');
}, 0);`;
      const result = parseCodeToStatements(code);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].startLine).toBe(1);
      expect(result.statements[0].endLine).toBe(3);
    });

    it("processes deeply nested callbacks (3 levels)", () => {
      const code = `fs.readFile('f', () => {
  setTimeout(() => {
    setImmediate(() => console.log('deep'));
  }, 0);
});`;
      const result = parseCodeToStatements(code);
      expect(result.statements).toHaveLength(1);
      const task = result.statements[0].task;
      expect(task).toBeDefined();
      expect(task!.children).toHaveLength(1);
      expect(task!.children![0].children).toHaveLength(1);
      expect(task!.children![0].children![0].type).toBe("setImmediate");
    });

    it("preserves source code in each statement", () => {
      const code = "setTimeout(() => console.log('timer'), 100);";
      const result = parseCodeToStatements(code);
      expect(result.statements[0].source).toBe(code);
    });
  });
});
