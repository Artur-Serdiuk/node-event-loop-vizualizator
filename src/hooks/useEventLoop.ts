import { useReducer, useCallback, useRef, useEffect } from "react";
import type { Task, ConsoleOutput, PlaybackSpeed } from "../types/eventLoop";
import {
  createInitialState,
  eventLoopReducer,
} from "../reducers/eventLoopReducer";

export const useEventLoop = () => {
  const [state, dispatch] = useReducer(
    eventLoopReducer,
    null,
    createInitialState,
  );
  const intervalRef = useRef<number | null>(null);

  const loadTasks = useCallback(
    (tasks: Task[], syncOutputs: ConsoleOutput[]) => {
      dispatch({ type: "LOAD_TASKS", payload: { tasks, syncOutputs } });
    },
    [],
  );

  const step = useCallback(() => {
    dispatch({ type: "STEP" });
  }, []);

  const play = useCallback(() => {
    dispatch({ type: "PLAY" });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: "PAUSE" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setSpeed = useCallback((speed: PlaybackSpeed) => {
    dispatch({ type: "SET_SPEED", payload: speed });
  }, []);

  // Auto-play interval
  useEffect(() => {
    const { eventLoop, speed } = state;
    if (eventLoop.isRunning && !eventLoop.isPaused && !eventLoop.finished) {
      const ms = Math.max(200, 1000 / speed);
      const interval = window.setInterval(() => {
        dispatch({ type: "STEP" });
      }, ms);
      intervalRef.current = interval;
      return () => clearInterval(interval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    state.eventLoop.isRunning,
    state.eventLoop.isPaused,
    state.eventLoop.finished,
    state.speed,
  ]);

  return {
    state: state.eventLoop,
    loadTasks,
    step,
    play,
    pause,
    reset,
    setSpeed,
    speed: state.speed,
  };
};
