// @vitest-environment jsdom
import "../test-setup";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventLoopPhases } from "./EventLoopPhases";
import { createInitialState } from "../reducers/eventLoopReducer";

afterEach(() => cleanup());

describe("EventLoopPhases", () => {
  it("renders the central event loop label", () => {
    const state = createInitialState().eventLoop;
    render(<EventLoopPhases state={state} />);
    expect(screen.getByText("Event Loop")).toBeTruthy();
  });

  it("renders all 6 phases with their labels", () => {
    const state = createInitialState().eventLoop;
    const { container } = render(<EventLoopPhases state={state} />);

    expect(container.textContent).toContain("Timers");
    expect(container.textContent).toContain("Pending I/O");
    expect(container.textContent).toContain("Idle / Prepare");
    expect(container.textContent).toContain("Poll");
    expect(container.textContent).toContain("Check");
    expect(container.textContent).toContain("Close Callbacks");
  });

  it("adds active class to the current phase", () => {
    const state = createInitialState().eventLoop;
    state.currentPhase = "poll";

    render(<EventLoopPhases state={state} />);

    // The phase label is "Poll". We need to find its parent container to check the class.
    const pollLabel = screen.getByText("Poll");
    const phaseContainer = pollLabel.parentElement;

    expect(phaseContainer?.className).toContain("active");
  });

  it("displays microtask indicator when in microtask phase", () => {
    const state = createInitialState().eventLoop;
    state.currentPhase = "microtask";

    const { container } = render(<EventLoopPhases state={state} />);
    expect(container.textContent).toContain("⚡ Draining Microtask Queue");
  });

  it("does not display microtask indicator when not in microtask phase", () => {
    const state = createInitialState().eventLoop; // default is 'stopped'
    const { container } = render(<EventLoopPhases state={state} />);
    expect(container.textContent).not.toContain("⚡ Draining Microtask Queue");
  });
});
