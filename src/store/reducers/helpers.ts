import type {
  EventLoopState,
  EventLoopPhase,
  Task,
  ExecutionHistoryItem,
  ConsoleOutput,
  PlaybackSpeed,
} from "../../types/eventLoop";
import { PHASE_ORDER } from "../../core/eventLoopSimulator";

// ── Reducer state ──────────────────────────────────────────────────────

export interface ReducerState {
  eventLoop: EventLoopState;
  speed: PlaybackSpeed;
}

// ── ID generators (resettable) ─────────────────────────────────────────

let historyCounter = 0;
let runtimeOutputCounter = 1000;

export const resetCounters = () => {
  historyCounter = 0;
  runtimeOutputCounter = 1000;
};

const nextHistoryId = () => `h_${++historyCounter}`;
const nextOutputId = () => `rout_${++runtimeOutputCounter}`;

// ── Factory helpers ────────────────────────────────────────────────────

const createEmptyPhaseQueues = () => ({
  timers: [] as Task[],
  pending: [] as Task[],
  idle: [] as Task[],
  poll: [] as Task[],
  check: [] as Task[],
  close: [] as Task[],
});

export const createEmptyEventLoop = (): EventLoopState => ({
  currentPhase: "stopped",
  previousPhase: null,
  phaseQueues: createEmptyPhaseQueues(),
  microtasks: { nextTick: [], promises: [] },
  callStack: [],
  consoleOutput: [],
  executionHistory: [],
  isRunning: false,
  isPaused: false,
  stepMode: false,
  currentIteration: 0,
  tick: 0,
  pollWaiting: false,
  finished: false,
  codeStatements: [],
  codeReadIndex: -1,
  codeFullyRead: true,
  highlightLines: null,
  sourceCode: "",
});

export const createInitialState = (): ReducerState => ({
  eventLoop: createEmptyEventLoop(),
  speed: 1,
});

// ── Queue helpers ──────────────────────────────────────────────────────

export const addTaskToQueues = (
  state: EventLoopState,
  task: Task,
): EventLoopState => {
  if (task.phase === "microtask") {
    const key = task.type === "nextTick" ? "nextTick" : "promises";
    return {
      ...state,
      microtasks: {
        ...state.microtasks,
        [key]: [...state.microtasks[key], task],
      },
    };
  }
  const phase = task.phase as EventLoopPhase;
  return {
    ...state,
    phaseQueues: {
      ...state.phaseQueues,
      [phase]: [...state.phaseQueues[phase], task],
    },
  };
};

export const hasMicrotasks = (state: EventLoopState): boolean =>
  state.microtasks.nextTick.length > 0 || state.microtasks.promises.length > 0;

export const hasAnyWork = (state: EventLoopState): boolean =>
  hasMicrotasks(state) ||
  PHASE_ORDER.some((p) => state.phaseQueues[p].length > 0);

// ── Core helper: execute a task and schedule its children ──────────────

/**
 * Execute a single task: remove it from queue, add history item + console
 * output, and schedule children.
 */
export function executeTask(
  prev: EventLoopState,
  task: Task,
  phase: EventLoopPhase | "microtask",
  tick: number,
  queueUpdate: Partial<EventLoopState>,
): EventLoopState {
  const historyItem: ExecutionHistoryItem = {
    id: nextHistoryId(),
    taskId: task.id,
    taskType: task.type,
    label: task.callback,
    phase,
    tick,
    iteration: prev.currentIteration,
  };

  const output: ConsoleOutput = {
    id: nextOutputId(),
    text: task.callback,
    tick,
    phase,
    taskType: task.type,
  };

  let newState: EventLoopState = {
    ...prev,
    ...queueUpdate,
    executionHistory: [...prev.executionHistory, historyItem],
    consoleOutput: [...prev.consoleOutput, output],
    callStack: [`${task.type}: ${task.callback}`],
    tick,
  };

  // Schedule children
  if (task.children) {
    for (const child of task.children) {
      newState = addTaskToQueues(newState, {
        ...child,
        createdAtTick: tick,
        executeAtTick: child.delay ? tick + child.delay : child.executeAtTick,
      });
    }
  }

  return newState;
}
