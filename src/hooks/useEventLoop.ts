import { useReducer, useCallback, useRef, useEffect } from "react";
import type { PlaybackSpeed, CodeStatement } from "../types/eventLoop";
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

  const loadCode = useCallback((statements: CodeStatement[], code: string) => {
    dispatch({ type: "RESET_AND_LOAD_CODE", payload: { statements, code } });
  }, []);

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

  const { isRunning, isPaused, finished } = state.eventLoop;

  // Auto-play interval
  useEffect(() => {
    if (isRunning && !isPaused && !finished) {
      const ms = Math.max(200, 1000 / state.speed);
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
  }, [isRunning, isPaused, finished, state.speed]);

  return {
    state: state.eventLoop,
    loadCode,
    step,
    play,
    pause,
    reset,
    setSpeed,
    speed: state.speed,
  };
};
