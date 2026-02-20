import type {
  EventLoopState,
  EventLoopPhase,
  EventLoopAction,
  Task,
  ExecutionHistoryItem,
  ConsoleOutput,
  PlaybackSpeed,
} from "../types/eventLoop";
import { PHASE_ORDER } from "../core/eventLoopSimulator";

// ── Reducer state ──────────────────────────────────────────────────────

export interface ReducerState {
  eventLoop: EventLoopState;
  speed: PlaybackSpeed;
}

// ── ID generators (resettable) ─────────────────────────────────────────

let historyCounter = 0;
let runtimeOutputCounter = 1000;

const resetCounters = () => {
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

const createEmptyEventLoop = (): EventLoopState => ({
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

const addTaskToQueues = (state: EventLoopState, task: Task): EventLoopState => {
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

const hasMicrotasks = (state: EventLoopState): boolean =>
  state.microtasks.nextTick.length > 0 || state.microtasks.promises.length > 0;

const hasAnyWork = (state: EventLoopState): boolean =>
  hasMicrotasks(state) ||
  PHASE_ORDER.some((p) => state.phaseQueues[p].length > 0);

// ── Core helper: execute a task and schedule its children ──────────────

/**
 * Execute a single task: remove it from queue, add history item + console
 * output, and schedule children. This is the shared logic that was previously
 * duplicated 4 times across microtask and macrotask execution.
 */
function executeTask(
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

// ── Step: code reading ─────────────────────────────────────────────────

function stepCode(prev: EventLoopState): EventLoopState {
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

// ── Step: microtask draining ───────────────────────────────────────────

function drainMicrotask(
  prev: EventLoopState,
  tick: number,
): EventLoopState | null {
  // nextTick has priority over promises
  const queueKey =
    prev.microtasks.nextTick.length > 0 ? "nextTick" : "promises";
  const queue = prev.microtasks[queueKey];

  if (queue.length === 0) return null;

  const task = queue[0];
  const remaining = queue.slice(1);

  const callStackPrefix =
    queueKey === "nextTick" ? "process.nextTick" : "Promise.then";

  const state = executeTask(prev, task, "microtask", tick, {
    microtasks: { ...prev.microtasks, [queueKey]: remaining },
    currentPhase: "microtask",
    previousPhase:
      prev.currentPhase !== "microtask"
        ? (prev.currentPhase as EventLoopPhase)
        : prev.previousPhase,
  });

  // Override callStack to use human-friendly label
  return { ...state, callStack: [`${callStackPrefix}: ${task.callback}`] };
}

// ── Step: resume after microtasks ──────────────────────────────────────

function resumeFromMicrotask(
  prev: EventLoopState,
  tick: number,
): EventLoopState {
  const resumePhase = prev.previousPhase || "timers";
  const resumeIdx = PHASE_ORDER.indexOf(resumePhase);
  const resumeQueue = prev.phaseQueues[resumePhase];

  // Check if the phase we came from still has work
  const phaseHasWork =
    resumePhase === "timers"
      ? resumeQueue.some(
          (t) => t.executeAtTick === undefined || t.executeAtTick <= tick,
        )
      : resumeQueue.length > 0;

  if (phaseHasWork) {
    return {
      ...prev,
      currentPhase: resumePhase,
      previousPhase: null,
      callStack: [`Event Loop: resuming ${resumePhase} phase`],
      tick,
    };
  }

  // Phase done — advance to next
  return advancePhase(prev, resumeIdx, tick);
}

// ── Step: execute current phase task ───────────────────────────────────

function executePhaseTask(
  prev: EventLoopState,
  phase: EventLoopPhase,
  tick: number,
): EventLoopState | null {
  const queue = prev.phaseQueues[phase];

  if (phase === "timers") {
    // Find first ready timer
    const readyIdx = queue.findIndex(
      (t) => t.executeAtTick === undefined || t.executeAtTick <= prev.tick,
    );
    if (readyIdx === -1) return null;

    const task = queue[readyIdx];
    const newQueue = [
      ...queue.slice(0, readyIdx),
      ...queue.slice(readyIdx + 1),
    ];
    return executeTask(prev, task, "timers", tick, {
      phaseQueues: { ...prev.phaseQueues, timers: newQueue },
    });
  }

  // All other phases: FIFO
  if (queue.length === 0) return null;

  const task = queue[0];
  return executeTask(prev, task, phase, tick, {
    phaseQueues: { ...prev.phaseQueues, [phase]: queue.slice(1) },
  });
}

// ── Step: advance to next phase ────────────────────────────────────────

function advancePhase(
  prev: EventLoopState,
  currentIdx: number,
  tick: number,
): EventLoopState {
  const nextIdx = currentIdx + 1;

  if (nextIdx >= PHASE_ORDER.length) {
    // Full cycle complete
    if (!hasAnyWork({ ...prev, tick })) {
      return {
        ...prev,
        currentPhase: "stopped",
        previousPhase: null,
        callStack: [],
        tick,
        finished: true,
        isRunning: false,
      };
    }
    return {
      ...prev,
      currentPhase: "timers",
      previousPhase: null,
      currentIteration: prev.currentIteration + 1,
      callStack: ["Event Loop: new iteration → timers"],
      tick,
    };
  }

  const nextPhase = PHASE_ORDER[nextIdx];
  return {
    ...prev,
    currentPhase: nextPhase,
    previousPhase: null,
    callStack: [`Event Loop: entering ${nextPhase} phase`],
    tick,
    pollWaiting: nextPhase === "poll" && prev.phaseQueues.poll.length === 0,
  };
}

// ── Main step function ─────────────────────────────────────────────────

function step(prev: EventLoopState): EventLoopState {
  if (prev.finished) return prev;

  // 1) Reading code line-by-line
  if (!prev.codeFullyRead) return stepCode(prev);

  const tick = prev.tick + 1;

  // 2) If stopped, check for remaining work or finish
  if (prev.currentPhase === "stopped") {
    if (!hasAnyWork(prev)) {
      return { ...prev, finished: true, isRunning: false };
    }
    return {
      ...prev,
      currentPhase: "timers",
      currentIteration: prev.currentIteration + 1,
      tick,
      callStack: ["Event Loop: entering timers phase"],
    };
  }

  // 3) Always drain microtasks first
  const microtaskResult = drainMicrotask(prev, tick);
  if (microtaskResult) return microtaskResult;

  // 4) If we just finished draining microtasks, resume from where we left
  if (prev.currentPhase === "microtask") {
    return resumeFromMicrotask(prev, tick);
  }

  // 5) Execute a task from the current phase
  const phase = prev.currentPhase as EventLoopPhase;
  const phaseResult = executePhaseTask(prev, phase, tick);
  if (phaseResult) return phaseResult;

  // 6) No tasks in this phase — advance
  return advancePhase(prev, PHASE_ORDER.indexOf(phase), tick);
}

// ── Reducer ────────────────────────────────────────────────────────────

export const eventLoopReducer = (
  state: ReducerState,
  action: EventLoopAction,
): ReducerState => {
  switch (action.type) {
    case "LOAD_TASKS": {
      let el = createEmptyEventLoop();
      el = { ...el, consoleOutput: [...action.payload.syncOutputs] };
      for (const task of action.payload.tasks) {
        el = addTaskToQueues(el, task);
      }
      el = {
        ...el,
        isRunning: false,
        isPaused: false,
        callStack: ["Script loaded — press Step or Play"],
      };
      return { ...state, eventLoop: el };
    }

    case "LOAD_CODE": {
      const el = createEmptyEventLoop();
      return {
        ...state,
        eventLoop: {
          ...el,
          codeStatements: action.payload.statements,
          codeReadIndex: -1,
          codeFullyRead: false,
          sourceCode: action.payload.code,
          callStack: ["Script loaded — press Step to read code line by line"],
        },
      };
    }

    case "STEP_CODE":
      return { ...state, eventLoop: stepCode(state.eventLoop) };

    case "STEP":
      return { ...state, eventLoop: step(state.eventLoop) };

    case "PLAY":
      return {
        ...state,
        eventLoop: { ...state.eventLoop, isRunning: true, isPaused: false },
      };

    case "PAUSE":
      return {
        ...state,
        eventLoop: { ...state.eventLoop, isPaused: true },
      };

    case "RESET":
      resetCounters();
      return createInitialState();

    case "RESET_AND_LOAD_CODE": {
      resetCounters();
      const fresh = createEmptyEventLoop();
      return {
        ...createInitialState(),
        eventLoop: {
          ...fresh,
          codeStatements: action.payload.statements,
          codeReadIndex: -1,
          codeFullyRead: false,
          sourceCode: action.payload.code,
          callStack: ["Script loaded — press Step to read code line by line"],
        },
      };
    }

    case "SET_SPEED":
      return { ...state, speed: action.payload };

    default:
      return state;
  }
};
