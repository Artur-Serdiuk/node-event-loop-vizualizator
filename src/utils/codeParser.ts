import * as acorn from "acorn";
import type { Task, ConsoleOutput } from "../types/eventLoop";

let taskCounter = 0;
let outputCounter = 0;

const nextTaskId = () => `task_${++taskCounter}`;
const nextOutputId = () => `out_${++outputCounter}`;

/** Scale ms delay to a reasonable tick count for visualization */
const delayToTicks = (ms: number): number => {
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 10));
};

export interface ParseResult {
  tasks: Task[];
  syncOutputs: ConsoleOutput[];
  errors: string[];
}

export const parseCode = (code: string): ParseResult => {
  taskCounter = 0;
  outputCounter = 0;

  const tasks: Task[] = [];
  const syncOutputs: ConsoleOutput[] = [];
  const errors: string[] = [];

  let ast: acorn.Program;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: "module",
      locations: true,
    });
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Syntax error");
    return { tasks, syncOutputs, errors };
  }

  function getSource(node: acorn.AnyNode): string {
    return code.slice(node.start, node.end);
  }

  function extractConsoleLogText(node: acorn.AnyNode): string | null {
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
      return getSource(node.expression)
        .replace("console.log(", "")
        .replace(/\)$/, "");
    }
    return null;
  }

  function extractCallbackBody(node: acorn.AnyNode): string[] {
    const logs: string[] = [];
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression"
    ) {
      const body = node.body;
      if (body.type === "BlockStatement") {
        for (const stmt of body.body) {
          const log = extractConsoleLogText(stmt);
          if (log !== null) logs.push(log);
        }
      } else {
        // arrow with expression body: () => console.log(...)
        const wrapper: acorn.ExpressionStatement = {
          type: "ExpressionStatement",
          expression: body,
          start: body.start,
          end: body.end,
        };
        const log = extractConsoleLogText(wrapper);
        if (log !== null) logs.push(log);
      }
    }
    return logs;
  }

  function getCallbackLabel(node: acorn.AnyNode): string {
    const logs = extractCallbackBody(node);
    if (logs.length > 0) return logs.join("; ");
    return getSource(node).substring(0, 60);
  }

  function processCallBody(node: acorn.AnyNode, parentTasks: Task[]) {
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression"
    ) {
      const body = node.body;
      if (body.type === "BlockStatement") {
        for (const stmt of body.body) {
          processNode(stmt, parentTasks, true);
        }
      }
    }
  }

  function processNode(
    node: acorn.AnyNode,
    parentTasks: Task[],
    insideCallback = false,
  ) {
    if (node.type === "ExpressionStatement") {
      processNode(node.expression, parentTasks, insideCallback);
      return;
    }

    if (node.type === "CallExpression") {
      const callee = node.callee;

      // setTimeout(cb, delay)
      if (callee.type === "Identifier" && callee.name === "setTimeout") {
        const cb = node.arguments[0];
        const delayNode = node.arguments[1];
        const delay =
          delayNode && delayNode.type === "Literal"
            ? Number(delayNode.value)
            : 0;
        const label = cb ? getCallbackLabel(cb) : "setTimeout callback";
        const children: Task[] = [];
        if (cb) processCallBody(cb, children);
        const task: Task = {
          id: nextTaskId(),
          type: "setTimeout",
          label: `setTimeout(${label}, ${delay})`,
          callback: label,
          phase: "timers",
          delay,
          createdAtTick: 0,
          executeAtTick: delayToTicks(delay),
          children: children.length > 0 ? children : undefined,
        };
        parentTasks.push(task);
        return;
      }

      // setImmediate(cb)
      if (callee.type === "Identifier" && callee.name === "setImmediate") {
        const cb = node.arguments[0];
        const label = cb ? getCallbackLabel(cb) : "setImmediate callback";
        const children: Task[] = [];
        if (cb) processCallBody(cb, children);
        const task: Task = {
          id: nextTaskId(),
          type: "setImmediate",
          label: `setImmediate(${label})`,
          callback: label,
          phase: "check",
          createdAtTick: 0,
          children: children.length > 0 ? children : undefined,
        };
        parentTasks.push(task);
        return;
      }

      // process.nextTick(cb)
      if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "process" &&
        callee.property.type === "Identifier" &&
        callee.property.name === "nextTick"
      ) {
        const cb = node.arguments[0];
        const label = cb ? getCallbackLabel(cb) : "nextTick callback";
        const children: Task[] = [];
        if (cb) processCallBody(cb, children);
        const task: Task = {
          id: nextTaskId(),
          type: "nextTick",
          label: `process.nextTick(${label})`,
          callback: label,
          phase: "microtask",
          createdAtTick: 0,
          children: children.length > 0 ? children : undefined,
        };
        parentTasks.push(task);
        return;
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
          const cb = node.arguments[0];
          const label = cb ? getCallbackLabel(cb) : "promise callback";
          const children: Task[] = [];
          if (cb) processCallBody(cb, children);
          const task: Task = {
            id: nextTaskId(),
            type: "promise",
            label: `Promise.then(${label})`,
            callback: label,
            phase: "microtask",
            createdAtTick: 0,
            children: children.length > 0 ? children : undefined,
          };
          parentTasks.push(task);
          return;
        }
      }

      // fs.readFile(path, cb)
      if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "fs" &&
        callee.property.type === "Identifier" &&
        (callee.property.name === "readFile" ||
          callee.property.name === "writeFile")
      ) {
        const lastArg = node.arguments[node.arguments.length - 1];
        const label = lastArg ? getCallbackLabel(lastArg) : "fs callback";
        const children: Task[] = [];
        if (lastArg) processCallBody(lastArg, children);
        const task: Task = {
          id: nextTaskId(),
          type: "fs",
          label: `fs.${(callee.property as acorn.Identifier).name}(${label})`,
          callback: label,
          phase: "poll",
          delay: 50,
          createdAtTick: 0,
          executeAtTick: delayToTicks(50),
          children: children.length > 0 ? children : undefined,
        };
        parentTasks.push(task);
        return;
      }

      // console.log — only sync at top level, skip inside callbacks
      if (!insideCallback) {
        const logText = extractConsoleLogText({
          type: "ExpressionStatement",
          expression: node,
          start: node.start,
          end: node.end,
        } as acorn.ExpressionStatement);
        if (logText !== null) {
          syncOutputs.push({
            id: nextOutputId(),
            text: logText,
            tick: 0,
            phase: "sync",
            taskType: "sync",
          });
          return;
        }
      }
    }

    // Variable declarations etc — skip
  }

  for (const node of ast.body) {
    processNode(node, tasks);
  }

  return { tasks, syncOutputs, errors };
};
