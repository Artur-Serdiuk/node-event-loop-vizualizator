import * as acorn from "acorn";
import type { Task, ConsoleOutput, CodeStatement } from "../types/eventLoop";

// ── ID generators ──────────────────────────────────────────────────────

interface IdCounters {
  task: number;
  output: number;
}

const createCounters = (): IdCounters => ({ task: 0, output: 0 });
const nextTaskId = (c: IdCounters) => `task_${++c.task}`;
const nextOutputId = (c: IdCounters) => `out_${++c.output}`;

// ── Helpers ────────────────────────────────────────────────────────────

/** Scale ms delay to a reasonable tick count for visualization */
const delayToTicks = (ms: number): number => {
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 10));
};

/** Get the raw source text for an AST node */
const getSource = (code: string, node: acorn.AnyNode): string =>
  code.slice(node.start, node.end);

/** If the node is `console.log(...)`, return the logged text; otherwise null */
function extractConsoleLogText(
  code: string,
  node: acorn.AnyNode,
): string | null {
  if (
    node.type === "ExpressionStatement" &&
    node.expression.type === "CallExpression" &&
    node.expression.callee.type === "MemberExpression" &&
    node.expression.callee.object.type === "Identifier" &&
    node.expression.callee.object.name === "console" &&
    node.expression.callee.property.type === "Identifier" &&
    node.expression.callee.property.name === "log"
  ) {
    const args = node.expression.arguments;
    if (args.length > 0 && args[0].type === "Literal") {
      return String(args[0].value);
    }
    return getSource(code, node.expression)
      .replace("console.log(", "")
      .replace(/\)$/, "");
  }
  return null;
}

/** Wrap an expression in a synthetic ExpressionStatement for `extractConsoleLogText` */
const wrapExpression = (expr: acorn.AnyNode): acorn.ExpressionStatement =>
  ({
    type: "ExpressionStatement",
    expression: expr,
    start: expr.start,
    end: expr.end,
  }) as acorn.ExpressionStatement;

/** Extract console.log texts from a callback body */
function extractCallbackBody(code: string, node: acorn.AnyNode): string[] {
  const logs: string[] = [];
  if (
    node.type !== "ArrowFunctionExpression" &&
    node.type !== "FunctionExpression"
  ) {
    return logs;
  }

  const body = node.body;
  if (body.type === "BlockStatement") {
    for (const stmt of body.body) {
      const log = extractConsoleLogText(code, stmt);
      if (log !== null) logs.push(log);
    }
  } else {
    // arrow with expression body: () => console.log(...)
    const log = extractConsoleLogText(code, wrapExpression(body));
    if (log !== null) logs.push(log);
  }
  return logs;
}

/** Build a human-readable label for a callback node */
function getCallbackLabel(code: string, node: acorn.AnyNode): string {
  const logs = extractCallbackBody(code, node);
  if (logs.length > 0) return logs.join("; ");
  return getSource(code, node).substring(0, 60);
}

// ── AST → Task mapping ────────────────────────────────────────────────

/** Configuration for creating a task from different API patterns */
interface TaskPattern {
  type: Task["type"];
  phase: Task["phase"];
  labelPrefix: string;
  getDelay?: (node: acorn.CallExpression) => number;
  getCallback: (node: acorn.CallExpression) => acorn.AnyNode | undefined;
  defaultLabel: string;
}

/** Try to match a CallExpression to a known API pattern */
function matchTaskPattern(
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

/** Recursively process callback body to find nested tasks */
function processCallBody(
  code: string,
  counters: IdCounters,
  node: acorn.AnyNode,
  parentTasks: Task[],
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
function buildTask(
  code: string,
  counters: IdCounters,
  pattern: TaskPattern,
  node: acorn.CallExpression,
): Task {
  const cb = pattern.getCallback(node);
  const delay = pattern.getDelay?.(node) ?? 0;
  const label = cb ? getCallbackLabel(code, cb) : pattern.defaultLabel;

  const children: Task[] = [];
  if (cb) processCallBody(code, counters, cb, children);

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

/**
 * Process a single AST node. Returns:
 * - `{ task }` if a macrotask / microtask was created
 * - `{ syncOutput }` if a sync console.log was found
 * - `undefined` for skipped nodes
 */
function processNode(
  code: string,
  counters: IdCounters,
  node: acorn.AnyNode,
  parentTasks: Task[],
  insideCallback = false,
): { task?: Task; syncOutput?: ConsoleOutput } | undefined {
  // Unwrap ExpressionStatement
  if (node.type === "ExpressionStatement") {
    return processNode(
      code,
      counters,
      node.expression,
      parentTasks,
      insideCallback,
    );
  }

  if (node.type !== "CallExpression") return undefined;

  // Try to match a known API pattern
  const pattern = matchTaskPattern(node.callee);
  if (pattern) {
    const task = buildTask(code, counters, pattern, node);
    parentTasks.push(task);
    return { task };
  }

  // console.log — only sync at top level, skip inside callbacks
  if (!insideCallback) {
    const logText = extractConsoleLogText(code, wrapExpression(node));
    if (logText !== null) {
      const syncOutput: ConsoleOutput = {
        id: nextOutputId(counters),
        text: logText,
        tick: 0,
        phase: "sync",
        taskType: "sync",
      };
      return { syncOutput };
    }
  }

  return undefined;
}

// ── Parsing helpers ────────────────────────────────────────────────────

function parseAST(code: string): { ast?: acorn.Program; error?: string } {
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: "module",
      locations: true,
    });
    return { ast };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Syntax error" };
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export interface ParseResult {
  tasks: Task[];
  syncOutputs: ConsoleOutput[];
  errors: string[];
}

export const parseCode = (code: string): ParseResult => {
  const counters = createCounters();
  const tasks: Task[] = [];
  const syncOutputs: ConsoleOutput[] = [];
  const errors: string[] = [];

  const { ast, error } = parseAST(code);
  if (error || !ast) {
    if (error) errors.push(error);
    return { tasks, syncOutputs, errors };
  }

  for (const node of ast.body) {
    const result = processNode(code, counters, node, tasks);
    if (result?.syncOutput) {
      syncOutputs.push(result.syncOutput);
    }
  }

  return { tasks, syncOutputs, errors };
};

export interface ParseStatementsResult {
  statements: CodeStatement[];
  errors: string[];
}

export const parseCodeToStatements = (code: string): ParseStatementsResult => {
  const counters = createCounters();
  const statements: CodeStatement[] = [];
  const errors: string[] = [];

  const { ast, error } = parseAST(code);
  if (error || !ast) {
    if (error) errors.push(error);
    return { statements, errors };
  }

  for (const node of ast.body) {
    const loc = (node as acorn.Node & { loc: acorn.SourceLocation }).loc;
    const startLine = loc ? loc.start.line : 1;
    const endLine = loc ? loc.end.line : 1;
    const source = code.slice(node.start, node.end);

    const parentTasks: Task[] = [];
    const result = processNode(code, counters, node, parentTasks);

    statements.push({
      startLine,
      endLine,
      source,
      task: result?.task,
      syncOutput: result?.syncOutput,
    });
  }

  return { statements, errors };
};
