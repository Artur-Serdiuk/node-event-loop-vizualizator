// @vitest-environment jsdom
import "../test-setup";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CallStack } from "../features/event-loop/CallStack";
import { ConsolePanel } from "../features/controls/ConsolePanel";
import { ControlPanel } from "../features/controls/ControlPanel";
import { ExecutionLog } from "../features/event-loop/ExecutionLog";
import { QueueDisplay } from "../features/event-loop/QueueDisplay";
import { MicrotaskDisplay } from "../features/event-loop/MicrotaskDisplay";
import type {
  ConsoleOutput,
  ExecutionHistoryItem,
  PhaseQueues,
  MicrotaskQueue,
  Task,
  PlaybackSpeed,
} from "../types/eventLoop";

afterEach(() => cleanup());

// ── Helpers ────────────────────────────────────────────────────────────

function makeOutput(overrides: Partial<ConsoleOutput> = {}): ConsoleOutput {
  return {
    id: "out_1",
    text: "hello",
    tick: 0,
    phase: "sync",
    taskType: "sync",
    ...overrides,
  };
}

function makeHistoryItem(
  overrides: Partial<ExecutionHistoryItem> = {},
): ExecutionHistoryItem {
  return {
    id: "h_1",
    taskId: "t_1",
    taskType: "setTimeout",
    label: "timer callback",
    phase: "timers",
    tick: 1,
    iteration: 0,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_1",
    type: "setTimeout",
    label: "setTimeout(test, 0)",
    callback: "test",
    phase: "timers",
    delay: 0,
    createdAtTick: 0,
    executeAtTick: 0,
    ...overrides,
  };
}

function emptyQueues(): PhaseQueues {
  return {
    timers: [],
    pending: [],
    idle: [],
    poll: [],
    check: [],
    close: [],
  };
}

function emptyMicrotasks(): MicrotaskQueue {
  return { nextTick: [], promises: [] };
}

// ── CallStack ──────────────────────────────────────────────────────────

describe("CallStack", () => {
  it("renders empty stack message when call stack is empty", () => {
    render(<CallStack callStack={[]} tick={0} iteration={0} />);
    expect(screen.getByText("Stack is empty")).toBeTruthy();
  });

  it("renders stack items", () => {
    render(
      <CallStack callStack={["setTimeout: callback"]} tick={5} iteration={2} />,
    );
    expect(screen.getByText("setTimeout: callback")).toBeTruthy();
  });

  it("displays tick and iteration values", () => {
    const { container } = render(
      <CallStack callStack={[]} tick={3} iteration={1} />,
    );
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("1");
  });
});

// ── ConsolePanel ───────────────────────────────────────────────────────

describe("ConsolePanel", () => {
  it("renders empty state message when no outputs", () => {
    render(<ConsolePanel outputs={[]} />);
    expect(screen.getByText("Run code to see console output...")).toBeTruthy();
  });

  it("renders console output lines", () => {
    const outputs = [
      makeOutput({ id: "o1", text: "hello" }),
      makeOutput({ id: "o2", text: "world" }),
    ];
    render(<ConsolePanel outputs={outputs} />);
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("world")).toBeTruthy();
  });

  it("shows phase labels in uppercase", () => {
    const outputs = [
      makeOutput({ id: "o1", phase: "sync" }),
      makeOutput({ id: "o2", phase: "timers" }),
    ];
    render(<ConsolePanel outputs={outputs} />);
    expect(screen.getByText("SYNC")).toBeTruthy();
    expect(screen.getByText("TIMERS")).toBeTruthy();
  });
});

// ── ControlPanel ───────────────────────────────────────────────────────

describe("ControlPanel", () => {
  const defaultProps = {
    isRunning: false,
    isPaused: false,
    finished: false,
    speed: 1 as PlaybackSpeed,
    codeFullyRead: true,
    isCodeLoaded: true,
    onPlay: () => {},
    onPause: () => {},
    onStep: () => {},
    onReset: () => {},
    onSpeedChange: () => {},
  };

  it("shows Play button when not running", () => {
    render(<ControlPanel {...defaultProps} />);
    expect(screen.getByText("▶ Play")).toBeTruthy();
  });

  it("shows Pause button when running", () => {
    render(<ControlPanel {...defaultProps} isRunning={true} />);
    expect(screen.getByText("⏸ Pause")).toBeTruthy();
  });

  it("shows Play button when paused", () => {
    render(<ControlPanel {...defaultProps} isRunning={true} isPaused={true} />);
    expect(screen.getByText("▶ Play")).toBeTruthy();
  });

  it("disables Play and Step when finished", () => {
    render(<ControlPanel {...defaultProps} finished={true} />);
    const playBtn = screen.getByText("▶ Play").closest("button")!;
    const stepBtn = screen.getByText("⏭ Step").closest("button")!;
    expect(playBtn.disabled).toBe(true);
    expect(stepBtn.disabled).toBe(true);
  });

  it("calls onPlay when Play is clicked", () => {
    let called = false;
    render(<ControlPanel {...defaultProps} onPlay={() => (called = true)} />);
    fireEvent.click(screen.getByText("▶ Play"));
    expect(called).toBe(true);
  });

  it("calls onStep when Step is clicked", () => {
    let called = false;
    render(<ControlPanel {...defaultProps} onStep={() => (called = true)} />);
    fireEvent.click(screen.getByText("⏭ Step"));
    expect(called).toBe(true);
  });

  it("calls onReset when Reset is clicked", () => {
    let called = false;
    render(<ControlPanel {...defaultProps} onReset={() => (called = true)} />);
    fireEvent.click(screen.getByText("↺ Reset"));
    expect(called).toBe(true);
  });

  it("calls onSpeedChange when speed button is clicked", () => {
    let newSpeed: PlaybackSpeed | null = null;
    render(
      <ControlPanel {...defaultProps} onSpeedChange={(s) => (newSpeed = s)} />,
    );
    fireEvent.click(screen.getByText("2x"));
    expect(newSpeed).toBe(2);
  });

  it("shows correct status text for each state", () => {
    const { unmount } = render(<ControlPanel {...defaultProps} />);
    expect(screen.getByText("○ Ready")).toBeTruthy();
    unmount();

    const { unmount: u2 } = render(
      <ControlPanel {...defaultProps} isRunning={true} />,
    );
    expect(screen.getByText("● Running")).toBeTruthy();
    u2();

    const { unmount: u3 } = render(
      <ControlPanel {...defaultProps} finished={true} />,
    );
    expect(screen.getByText("✓ Finished")).toBeTruthy();
    u3();

    render(
      <ControlPanel
        {...defaultProps}
        isCodeLoaded={true}
        codeFullyRead={false}
      />,
    );
    expect(screen.getByText("📖 Reading Code")).toBeTruthy();
  });
});

// ── ExecutionLog ────────────────────────────────────────────────────────

describe("ExecutionLog", () => {
  it("renders empty state", () => {
    render(<ExecutionLog history={[]} />);
    expect(screen.getByText("No tasks executed yet")).toBeTruthy();
  });

  it("renders history items with labels and ticks", () => {
    const history = [
      makeHistoryItem({ id: "h1", label: "timer cb", tick: 1 }),
      makeHistoryItem({ id: "h2", label: "nextTick cb", tick: 2 }),
    ];
    render(<ExecutionLog history={history} />);
    expect(screen.getByText("timer cb")).toBeTruthy();
    expect(screen.getByText("nextTick cb")).toBeTruthy();
    expect(screen.getByText("t1")).toBeTruthy();
    expect(screen.getByText("t2")).toBeTruthy();
  });
});

// ── QueueDisplay ───────────────────────────────────────────────────────

describe("QueueDisplay", () => {
  it("renders all shown phase sections", () => {
    render(<QueueDisplay phaseQueues={emptyQueues()} currentPhase="stopped" />);
    expect(screen.getByText("⏱ Timers")).toBeTruthy();
    expect(screen.getByText("📡 Poll")).toBeTruthy();
    expect(screen.getByText("✅ Check")).toBeTruthy();
    expect(screen.getByText("🔒 Close")).toBeTruthy();
  });

  it("shows Empty for phases with no tasks", () => {
    render(<QueueDisplay phaseQueues={emptyQueues()} currentPhase="stopped" />);
    const empties = screen.getAllByText("Empty");
    expect(empties.length).toBe(4);
  });

  it("renders tasks in queue with type and callback", () => {
    const queues = emptyQueues();
    queues.timers = [makeTask({ id: "t1", callback: "timeout cb" })];
    render(<QueueDisplay phaseQueues={queues} currentPhase="timers" />);
    expect(screen.getByText("timeout cb")).toBeTruthy();
    expect(screen.getByText("setTimeout")).toBeTruthy();
  });

  it("shows delay badge for tasks with delay", () => {
    const queues = emptyQueues();
    queues.timers = [makeTask({ delay: 100 })];
    render(<QueueDisplay phaseQueues={queues} currentPhase="stopped" />);
    expect(screen.getByText("100ms")).toBeTruthy();
  });
});

// ── MicrotaskDisplay ───────────────────────────────────────────────────

describe("MicrotaskDisplay", () => {
  it("renders empty queues with Empty labels", () => {
    render(<MicrotaskDisplay microtasks={emptyMicrotasks()} />);
    const empties = screen.getAllByText("Empty");
    expect(empties.length).toBe(2);
  });

  it("renders nextTick task callbacks", () => {
    const microtasks: MicrotaskQueue = {
      nextTick: [
        makeTask({ id: "nt1", type: "nextTick", callback: "tick cb" }),
      ],
      promises: [],
    };
    render(<MicrotaskDisplay microtasks={microtasks} />);
    expect(screen.getByText("tick cb")).toBeTruthy();
  });

  it("renders promise task callbacks", () => {
    const microtasks: MicrotaskQueue = {
      nextTick: [],
      promises: [
        makeTask({ id: "p1", type: "promise", callback: "promise cb" }),
      ],
    };
    render(<MicrotaskDisplay microtasks={microtasks} />);
    expect(screen.getByText("promise cb")).toBeTruthy();
  });

  it("displays queue section titles", () => {
    const { container } = render(
      <MicrotaskDisplay microtasks={emptyMicrotasks()} />,
    );
    expect(container.textContent).toContain("process.nextTick");
    expect(container.textContent).toContain("Promise.then");
  });
});
