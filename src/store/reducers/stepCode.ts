import type { EventLoopState } from "../../types/eventLoop";
import { addTaskToQueues } from "./helpers";

/**
 * Advance code reading by one statement.
 * Highlights the current line, enqueues any task, and appends sync output.
 */
export function stepCode(prev: EventLoopState): EventLoopState {
  if (prev.codeFullyRead) return prev;

  const nextIndex = prev.codeReadIndex + 1;
  if (nextIndex >= prev.codeStatements.length) {
    return {
      ...prev,
      codeFullyRead: true,
      codeReadIndex: nextIndex,
      highlightLines: null,
      callStack: ["Script fully read — press Step or Play to execute"],
    };
  }

  const stmt = prev.codeStatements[nextIndex];
  let newState: EventLoopState = {
    ...prev,
    codeReadIndex: nextIndex,
    highlightLines: { start: stmt.startLine, end: stmt.endLine },
    callStack: [
      `Reading: ${stmt.source.substring(0, 80)}${stmt.source.length > 80 ? "..." : ""}`,
    ],
  };

  if (stmt.task) {
    newState = addTaskToQueues(newState, stmt.task);
  }
  if (stmt.syncOutput) {
    newState = {
      ...newState,
      consoleOutput: [...newState.consoleOutput, stmt.syncOutput],
    };
  }

  // Check if this was the last statement
  if (nextIndex >= prev.codeStatements.length - 1) {
    newState = {
      ...newState,
      codeFullyRead: true,
      callStack: ["Script fully read — press Step or Play to execute"],
    };
  }

  return newState;
}
