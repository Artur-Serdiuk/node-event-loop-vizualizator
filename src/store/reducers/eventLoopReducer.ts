import type { EventLoopAction } from "../../types/eventLoop";
import {
  type ReducerState,
  createInitialState,
  createEmptyEventLoop,
  addTaskToQueues,
  resetCounters,
} from "./helpers";
import { stepCode } from "./stepCode";
import { step } from "./stepEventLoop";

// Re-export for external consumers
export { createInitialState, type ReducerState } from "./helpers";

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
