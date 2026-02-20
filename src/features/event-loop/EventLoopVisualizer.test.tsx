// @vitest-environment jsdom
import "../../test-setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { EventLoopVisualizer } from "./EventLoopVisualizer";
import { codeExamples } from "../../data/examples";

afterEach(() => cleanup());

describe("EventLoopVisualizer Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it("renders the main layout correctly", () => {
    render(<EventLoopVisualizer />);

    // Top-level elements
    expect(screen.getByText("⚡ Node.js Event Loop Visualizer")).toBeTruthy();
    expect(screen.getByText("📝 Code")).toBeTruthy();
    expect(screen.getByText("Event Loop")).toBeTruthy();
    expect(screen.getByText("📚 Call Stack")).toBeTruthy();
    expect(screen.getByText("🖥 Console Output")).toBeTruthy();
  });

  it("loads an example and allows stepping through it", () => {
    render(<EventLoopVisualizer />);

    // Select the "Basic Timers" example (codeExamples[0])
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: codeExamples[0].id } });

    // Click Run Code
    const runBtn = screen.getByText("▶ Run Code");
    fireEvent.click(runBtn);

    // The control panel should transition to showing "📖 Reading Code" or ready
    // Actually the first click of Run Code parses the code and transitions the state
    // Let's check that the step button is available
    expect(screen.getByText("⏭ Step")).toBeTruthy();

    // Step forward several times
    const stepBtn = screen.getByText("⏭ Step");
    act(() => {
      fireEvent.click(stepBtn);
    }); // Reads line 1
    act(() => {
      fireEvent.click(stepBtn);
    }); // Reads line 2
    act(() => {
      fireEvent.click(stepBtn);
    }); // Reads line 3

    // Eventually the code loading is done, and it starts executing.
    // Let's just click Play and advance timers to completion
    const playBtn = screen.getByText("▶ Play");
    act(() => {
      fireEvent.click(playBtn);
    });

    // Let the event loop run by manually advancing intervals
    for (let i = 0; i < 50; i++) {
      act(() => {
        vi.advanceTimersByTime(200);
      });
    }

    // It should have executed the code, logged "Start" and "End" initially
    // Since we fast forwarded, we should see "Start", "End" and "Timeout 1", "Timeout 2" in the console
    // Check if expected outputs exist somewhere in the DOM (Console Panel)
    const consoleContainer =
      screen.getByText("🖥 Console Output").parentElement?.parentElement;
    expect(consoleContainer?.textContent).toContain("timeout 1");
    expect(consoleContainer?.textContent).toContain("immediate");
  });
});
