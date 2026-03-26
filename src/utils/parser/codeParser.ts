import * as acorn from "acorn";
import type { Task, ConsoleOutput, CodeStatement } from "../../types/eventLoop";
import { extractConsoleLogText, wrapExpression } from "./astHelpers";
import {
  type IdCounters,
  createCounters,
  nextOutputId,
  matchTaskPattern,
  buildTask,
} from "./taskPatterns";

// ── Process a single AST node ──────────────────────────────────────────

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
    const task = buildTask(code, counters, pattern, node, processNode);
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
