export type EventLoopPhase =
  | "timers"
  | "pending"
  | "idle"
  | "poll"
  | "check"
  | "close";

export type TaskType =
  | "setTimeout"
  | "setInterval"
  | "setImmediate"
  | "nextTick"
  | "promise"
  | "fs"
  | "network"
  | "close"
  | "sync";

export interface CodeStatement {
  startLine: number;
  endLine: number;
  source: string;
  task?: Task;
  syncOutput?: ConsoleOutput;
}

export interface Task {
  id: string;
  type: TaskType;
  label: string;
  callback: string;
  phase: EventLoopPhase | "microtask";
  delay?: number;
  createdAtTick: number;
  executeAtTick?: number;
  children?: Task[];
}

export interface ConsoleOutput {
  id: string;
  text: string;
  tick: number;
  phase: EventLoopPhase | "microtask" | "sync";
  taskType: TaskType;
}

export interface MicrotaskQueue {
  nextTick: Task[];
  promises: Task[];
}

export interface PhaseQueues {
  timers: Task[];
  pending: Task[];
  idle: Task[];
  poll: Task[];
  check: Task[];
  close: Task[];
}

export interface ExecutionHistoryItem {
  id: string;
  taskId: string;
  taskType: TaskType;
  label: string;
  phase: EventLoopPhase | "microtask" | "sync";
  tick: number;
  iteration: number;
}

export interface EventLoopState {
  currentPhase: EventLoopPhase | "stopped" | "microtask";
  previousPhase: EventLoopPhase | null;
  phaseQueues: PhaseQueues;
  microtasks: MicrotaskQueue;
  callStack: string[];
  consoleOutput: ConsoleOutput[];
  executionHistory: ExecutionHistoryItem[];
  isRunning: boolean;
  isPaused: boolean;
  stepMode: boolean;
  currentIteration: number;
  tick: number;
  pollWaiting: boolean;
  finished: boolean;
  // code-reading state
  codeStatements: CodeStatement[];
  codeReadIndex: number; // -1 = not started, 0..n = current index
  codeFullyRead: boolean;
  highlightLines: { start: number; end: number } | null;
  sourceCode: string;
}

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export type EventLoopAction =
  | {
      type: "LOAD_TASKS";
      payload: { tasks: Task[]; syncOutputs: ConsoleOutput[] };
    }
  | {
      type: "LOAD_CODE";
      payload: { statements: CodeStatement[]; code: string };
    }
  | { type: "STEP" }
  | { type: "STEP_CODE" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | {
      type: "RESET_AND_LOAD_CODE";
      payload: { statements: CodeStatement[]; code: string };
    }
  | { type: "SET_SPEED"; payload: PlaybackSpeed };
