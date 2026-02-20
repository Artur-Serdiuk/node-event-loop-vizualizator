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

export interface ReducerState {
  eventLoop: EventLoopState;
  speed: PlaybackSpeed;
}

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
});

export const createInitialState = (): ReducerState => ({
  eventLoop: createEmptyEventLoop(),
  speed: 1,
});

// ----- helpers -----

const addTaskToQueues = (state: EventLoopState, task: Task): EventLoopState => {
  if (task.phase === "microtask") {
    const microtasks = { ...state.microtasks };
    if (task.type === "nextTick") {
      microtasks.nextTick = [...microtasks.nextTick, task];
    } else {
      microtasks.promises = [...microtasks.promises, task];
    }
    return { ...state, microtasks };
  }
  const phaseQueues = { ...state.phaseQueues };
  const phase = task.phase as EventLoopPhase;
  phaseQueues[phase] = [...phaseQueues[phase], task];
  return { ...state, phaseQueues };
};

const hasMicrotasks = (state: EventLoopState): boolean =>
  state.microtasks.nextTick.length > 0 || state.microtasks.promises.length > 0;

const hasAnyWork = (state: EventLoopState): boolean => {
  if (hasMicrotasks(state)) return true;
  return PHASE_ORDER.some((p) => state.phaseQueues[p].length > 0);
};

const nextHistoryId = (() => {
  let c = 0;
  return () => `h_${++c}`;
})();

const nextOutputId = (() => {
  let c = 1000;
  return () => `rout_${++c}`;
})();

// Execute one step at a time to give the user visible feedback
const step = (prev: EventLoopState): EventLoopState => {
  if (prev.finished) return prev;

  const tick = prev.tick + 1;

  // 1) If we're stopped, check if there's any work
  if (prev.currentPhase === "stopped") {
    if (!hasAnyWork(prev)) {
      return { ...prev, finished: true, isRunning: false };
    }
    // Start a new iteration from timers
    return {
      ...prev,
      currentPhase: "timers",
      currentIteration: prev.currentIteration + 1,
      tick,
      callStack: ["Event Loop: entering timers phase"],
    };
  }

  // 2) Always drain microtasks first (nextTick has priority)
  if (prev.microtasks.nextTick.length > 0) {
    const task = prev.microtasks.nextTick[0];
    const remaining = prev.microtasks.nextTick.slice(1);
    const historyItem: ExecutionHistoryItem = {
      id: nextHistoryId(),
      taskId: task.id,
      taskType: task.type,
      label: task.callback,
      phase: "microtask",
      tick,
      iteration: prev.currentIteration,
    };
    const output: ConsoleOutput = {
      id: nextOutputId(),
      text: task.callback,
      tick,
      phase: "microtask",
      taskType: "nextTick",
    };
    let newState: EventLoopState = {
      ...prev,
      microtasks: { ...prev.microtasks, nextTick: remaining },
      executionHistory: [...prev.executionHistory, historyItem],
      consoleOutput: [...prev.consoleOutput, output],
      callStack: [`process.nextTick: ${task.callback}`],
      currentPhase: "microtask",
      previousPhase:
        prev.currentPhase !== "microtask"
          ? (prev.currentPhase as EventLoopPhase)
          : prev.previousPhase,
      tick,
    };
    // Schedule children
    if (task.children) {
      for (const child of task.children) {
        const c = {
          ...child,
          createdAtTick: tick,
          executeAtTick: child.delay ? tick + child.delay : child.executeAtTick,
        };
        newState = addTaskToQueues(newState, c);
      }
    }
    return newState;
  }

  if (prev.microtasks.promises.length > 0) {
    const task = prev.microtasks.promises[0];
    const remaining = prev.microtasks.promises.slice(1);
    const historyItem: ExecutionHistoryItem = {
      id: nextHistoryId(),
      taskId: task.id,
      taskType: task.type,
      label: task.callback,
      phase: "microtask",
      tick,
      iteration: prev.currentIteration,
    };
    const output: ConsoleOutput = {
      id: nextOutputId(),
      text: task.callback,
      tick,
      phase: "microtask",
      taskType: "promise",
    };
    let newState: EventLoopState = {
      ...prev,
      microtasks: { ...prev.microtasks, promises: remaining },
      executionHistory: [...prev.executionHistory, historyItem],
      consoleOutput: [...prev.consoleOutput, output],
      callStack: [`Promise.then: ${task.callback}`],
      currentPhase: "microtask",
      previousPhase:
        prev.currentPhase !== "microtask"
          ? (prev.currentPhase as EventLoopPhase)
          : prev.previousPhase,
      tick,
    };
    if (task.children) {
      for (const child of task.children) {
        const c = {
          ...child,
          createdAtTick: tick,
          executeAtTick: child.delay ? tick + child.delay : child.executeAtTick,
        };
        newState = addTaskToQueues(newState, c);
      }
    }
    return newState;
  }

  // 2.5) If we were draining microtasks but none remain, advance from where we left off
  if (prev.currentPhase === "microtask") {
    const resumePhase = prev.previousPhase || "timers";
    const resumeIdx = PHASE_ORDER.indexOf(resumePhase);
    // The task in resumePhase was already executed (which triggered microtasks),
    // so check if resumePhase still has work — if so, stay; otherwise advance.
    const resumeQueue = prev.phaseQueues[resumePhase];
    if (resumePhase === "timers") {
      const hasReady = resumeQueue.some(
        (t) => t.executeAtTick === undefined || t.executeAtTick <= tick,
      );
      if (hasReady) {
        return {
          ...prev,
          currentPhase: "timers",
          previousPhase: null,
          callStack: ["Event Loop: resuming timers phase"],
          tick,
        };
      }
    } else if (resumeQueue.length > 0) {
      return {
        ...prev,
        currentPhase: resumePhase,
        previousPhase: null,
        callStack: [`Event Loop: resuming ${resumePhase} phase`],
        tick,
      };
    }
    // resumePhase is done, advance to next phase
    const nextIdx = resumeIdx + 1;
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
    };
  }

  // 3) Execute current phase
  const phase = prev.currentPhase as EventLoopPhase;
  const queue = prev.phaseQueues[phase];

  if (phase === "timers") {
    // Find first ready timer
    const readyIdx = queue.findIndex(
      (t) => t.executeAtTick === undefined || t.executeAtTick <= prev.tick,
    );
    if (readyIdx !== -1) {
      const task = queue[readyIdx];
      const newQueue = [
        ...queue.slice(0, readyIdx),
        ...queue.slice(readyIdx + 1),
      ];
      const historyItem: ExecutionHistoryItem = {
        id: nextHistoryId(),
        taskId: task.id,
        taskType: task.type,
        label: task.callback,
        phase: "timers",
        tick,
        iteration: prev.currentIteration,
      };
      const output: ConsoleOutput = {
        id: nextOutputId(),
        text: task.callback,
        tick,
        phase: "timers",
        taskType: task.type,
      };
      let newState: EventLoopState = {
        ...prev,
        phaseQueues: { ...prev.phaseQueues, timers: newQueue },
        executionHistory: [...prev.executionHistory, historyItem],
        consoleOutput: [...prev.consoleOutput, output],
        callStack: [`${task.type}: ${task.callback}`],
        tick,
      };
      if (task.children) {
        for (const child of task.children) {
          const c = {
            ...child,
            createdAtTick: tick,
            executeAtTick: child.delay
              ? tick + child.delay
              : child.executeAtTick,
          };
          newState = addTaskToQueues(newState, c);
        }
      }
      return newState;
    }
    // No ready timers, advance phase
  }

  if (phase !== "timers" && queue.length > 0) {
    const task = queue[0];
    const newQueue = queue.slice(1);
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
      phaseQueues: { ...prev.phaseQueues, [phase]: newQueue },
      executionHistory: [...prev.executionHistory, historyItem],
      consoleOutput: [...prev.consoleOutput, output],
      callStack: [`${task.type}: ${task.callback}`],
      tick,
    };
    if (task.children) {
      for (const child of task.children) {
        const c = {
          ...child,
          createdAtTick: tick,
          executeAtTick: child.delay ? tick + child.delay : child.executeAtTick,
        };
        newState = addTaskToQueues(newState, c);
      }
    }
    return newState;
  }

  // 4) Advance to next phase
  const currentIdx = PHASE_ORDER.indexOf(phase);
  const nextIdx = currentIdx + 1;

  if (nextIdx >= PHASE_ORDER.length) {
    // Completed one full cycle
    if (!hasAnyWork({ ...prev, tick })) {
      return {
        ...prev,
        currentPhase: "stopped",
        callStack: [],
        tick,
        finished: true,
        isRunning: false,
      };
    }
    return {
      ...prev,
      currentPhase: "timers",
      currentIteration: prev.currentIteration + 1,
      callStack: ["Event Loop: new iteration → timers"],
      tick,
    };
  }

  const nextPhase = PHASE_ORDER[nextIdx];
  return {
    ...prev,
    currentPhase: nextPhase,
    callStack: [`Event Loop: entering ${nextPhase} phase`],
    tick,
    pollWaiting: nextPhase === "poll" && prev.phaseQueues.poll.length === 0,
  };
};

export const eventLoopReducer = (
  state: ReducerState,
  action: EventLoopAction,
): ReducerState => {
  switch (action.type) {
    case "LOAD_TASKS": {
      let el = createEmptyEventLoop();
      // Add sync outputs
      el = { ...el, consoleOutput: [...action.payload.syncOutputs] };
      // Distribute tasks to queues
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
      return createInitialState();
    case "SET_SPEED":
      return { ...state, speed: action.payload };
    default:
      return state;
  }
};
