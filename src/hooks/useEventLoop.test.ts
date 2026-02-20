// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEventLoop } from "./useEventLoop";
import type { CodeStatement } from "../types/eventLoop";

const MOCK_STATEMENT: CodeStatement = {
  source: "console.log('test');",
  startLine: 1,
  endLine: 1,
  syncOutput: {
    id: "out_1",
    text: "test",
    tick: 0,
    phase: "sync",
    taskType: "sync",
  },
};

describe("useEventLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useEventLoop());

    expect(result.current.state.tick).toBe(0);
    expect(result.current.state.finished).toBe(false);
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.isPaused).toBe(false);
  });

  it("should load code and transition to code-reading state", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      result.current.loadCode([MOCK_STATEMENT], "console.log('test');");
    });

    expect(result.current.state.codeStatements).toHaveLength(1);
    expect(result.current.state.codeFullyRead).toBe(false);
  });

  it("should advance state on step", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      // Load code so we are not immediately finished
      result.current.loadCode([MOCK_STATEMENT], "console.log('test');");
    });

    act(() => {
      result.current.step(); // This will execute STEP_CODE since code is not fully read
    });

    expect(result.current.state.codeReadIndex).toBe(0);
  });

  it("should run on intervals when play is called", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      // Load code to have something to process
      result.current.loadCode([MOCK_STATEMENT, MOCK_STATEMENT], "...");
      result.current.play();
    });

    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.isPaused).toBe(false);

    const intervalTime = Math.max(200, 1000 / result.current.speed);

    act(() => {
      // Fast forward by exactly 1 interval
      vi.advanceTimersByTime(intervalTime);
    });

    // After 1 step interval, codeReadIndex should be 0
    expect(result.current.state.codeReadIndex).toBe(0);
  });

  it("should pause execution when pause is called", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      result.current.loadCode([MOCK_STATEMENT, MOCK_STATEMENT], "...");
      result.current.play();
    });

    expect(result.current.state.isRunning).toBe(true);

    act(() => {
      result.current.pause();
    });

    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.isPaused).toBe(true);

    const prevIndex = result.current.state.codeReadIndex;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should not have advanced
    expect(result.current.state.codeReadIndex).toBe(prevIndex);
  });

  it("should clear interval on reset", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      result.current.loadCode([MOCK_STATEMENT], "...");
      result.current.play();
    });

    expect(result.current.state.isRunning).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.codeStatements).toHaveLength(0); // reset clears it
  });

  it("should recalculate interval when speed changes", () => {
    const { result } = renderHook(() => useEventLoop());

    act(() => {
      result.current.loadCode([MOCK_STATEMENT, MOCK_STATEMENT], "...");
      result.current.setSpeed(2); // speed 2x -> 500ms
      result.current.play();
    });

    expect(result.current.speed).toBe(2);
    expect(result.current.state.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // It advanced 1 step because 500ms passed
    expect(result.current.state.codeReadIndex).toBe(0);
  });
});
