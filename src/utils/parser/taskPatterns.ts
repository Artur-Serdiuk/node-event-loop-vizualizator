import * as acorn from "acorn";
import type { Task } from "../../types/eventLoop";
import { getCallbackLabel } from "./astHelpers";

// ── ID counters ────────────────────────────────────────────────────────

export interface IdCounters {
  task: number;
  output: number;
}

export const createCounters = (): IdCounters => ({ task: 0, output: 0 });
export const nextTaskId = (c: IdCounters) => `task_${++c.task}`;
export const nextOutputId = (c: IdCounters) => `out_${++c.output}`;

// ── Delay helper ───────────────────────────────────────────────────────

/** Scale ms delay to a reasonable tick count for visualization */
export const delayToTicks = (ms: number): number => {
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 10));
};

// ── Task pattern matching ──────────────────────────────────────────────

/** Configuration for creating a task from different API patterns */
export interface TaskPattern {
  type: Task["type"];
  phase: Task["phase"];
  labelPrefix: string;
  getDelay?: (node: acorn.CallExpression) => number;
  getCallback: (node: acorn.CallExpression) => acorn.AnyNode | undefined;
  defaultLabel: string;
}

/** Try to match a CallExpression to a known API pattern */
export function matchTaskPattern(
  callee: acorn.CallExpression["callee"],
): TaskPattern | null {
  // setTimeout(cb, delay)
  if (callee.type === "Identifier" && callee.name === "setTimeout") {
    return {
      type: "setTimeout",
      phase: "timers",
      labelPrefix: "setTimeout",
      getDelay: (n) => {
        const arg = n.arguments[1];
        return arg && arg.type === "Literal" ? Number(arg.value) : 0;
      },
      getCallback: (n) => n.arguments[0],
      defaultLabel: "setTimeout callback",
    };
  }

  // setImmediate(cb)
  if (callee.type === "Identifier" && callee.name === "setImmediate") {
    return {
      type: "setImmediate",
      phase: "check",
      labelPrefix: "setImmediate",
      getCallback: (n) => n.arguments[0],
      defaultLabel: "setImmediate callback",
    };
  }

  // process.nextTick(cb)
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "process" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "nextTick"
  ) {
    return {
      type: "nextTick",
      phase: "microtask",
      labelPrefix: "process.nextTick",
      getCallback: (n) => n.arguments[0],
      defaultLabel: "nextTick callback",
    };
  }

  // Promise.resolve().then(cb)
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "then"
  ) {
    const obj = callee.object;
    if (
      obj.type === "CallExpression" &&
      obj.callee.type === "MemberExpression" &&
      obj.callee.object.type === "Identifier" &&
      obj.callee.object.name === "Promise" &&
      obj.callee.property.type === "Identifier" &&
      obj.callee.property.name === "resolve"
    ) {
      return {
        type: "promise",
        phase: "microtask",
        labelPrefix: "Promise.then",
        getCallback: (n) => n.arguments[0],
        defaultLabel: "promise callback",
      };
    }
  }

  // fs.readFile / fs.writeFile
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "fs" &&
    callee.property.type === "Identifier" &&
    (callee.property.name === "readFile" ||
      callee.property.name === "writeFile")
  ) {
    const methodName = (callee.property as acorn.Identifier).name;
    return {
      type: "fs",
      phase: "poll",
      labelPrefix: `fs.${methodName}`,
      getDelay: () => 50,
      getCallback: (n) => n.arguments[n.arguments.length - 1],
      defaultLabel: "fs callback",
    };
  }

  return null;
}

// ── Task building ──────────────────────────────────────────────────────

/** Recursively process callback body to find nested tasks */
export function processCallBody(
  code: string,
  counters: IdCounters,
  node: acorn.AnyNode,
  parentTasks: Task[],
  processNode: (
    code: string,
    counters: IdCounters,
    node: acorn.AnyNode,
    parentTasks: Task[],
    insideCallback: boolean,
  ) => { task?: Task } | undefined,
) {
  if (
    node.type !== "ArrowFunctionExpression" &&
    node.type !== "FunctionExpression"
  ) {
    return;
  }
  const body = node.body;
  if (body.type === "BlockStatement") {
    for (const stmt of body.body) {
      processNode(code, counters, stmt, parentTasks, true);
    }
  }
}

/** Build a Task from a matched pattern */
export function buildTask(
  code: string,
  counters: IdCounters,
  pattern: TaskPattern,
  node: acorn.CallExpression,
  processNode: (
    code: string,
    counters: IdCounters,
    node: acorn.AnyNode,
    parentTasks: Task[],
    insideCallback: boolean,
  ) => { task?: Task } | undefined,
): Task {
  const cb = pattern.getCallback(node);
  const delay = pattern.getDelay?.(node) ?? 0;
  const label = cb ? getCallbackLabel(code, cb) : pattern.defaultLabel;

  const children: Task[] = [];
  if (cb) processCallBody(code, counters, cb, children, processNode);

  return {
    id: nextTaskId(counters),
    type: pattern.type,
    label:
      pattern.getDelay !== undefined
        ? `${pattern.labelPrefix}(${label}, ${delay})`
        : `${pattern.labelPrefix}(${label})`,
    callback: label,
    phase: pattern.phase,
    delay: pattern.getDelay !== undefined ? delay : undefined,
    createdAtTick: 0,
    executeAtTick:
      pattern.getDelay !== undefined ? delayToTicks(delay) : undefined,
    children: children.length > 0 ? children : undefined,
  };
}
