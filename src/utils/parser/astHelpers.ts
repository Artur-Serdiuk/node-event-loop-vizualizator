import * as acorn from "acorn";

/** Get the raw source text for an AST node */
export const getSource = (code: string, node: acorn.AnyNode): string =>
  code.slice(node.start, node.end);

/** If the node is `console.log(...)`, return the logged text; otherwise null */
export function extractConsoleLogText(
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
export const wrapExpression = (
  expr: acorn.AnyNode,
): acorn.ExpressionStatement =>
  ({
    type: "ExpressionStatement",
    expression: expr,
    start: expr.start,
    end: expr.end,
  }) as acorn.ExpressionStatement;

/** Extract console.log texts from a callback body */
export function extractCallbackBody(
  code: string,
  node: acorn.AnyNode,
): string[] {
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
export function getCallbackLabel(code: string, node: acorn.AnyNode): string {
  const logs = extractCallbackBody(code, node);
  if (logs.length > 0) return logs.join("; ");
  return getSource(code, node).substring(0, 60);
}
