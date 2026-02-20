import type { EventLoopPhase, PhaseQueues, Task } from "../types/eventLoop";
import styles from "./QueueDisplay.module.css";

interface QueueDisplayProps {
  phaseQueues: PhaseQueues;
  currentPhase: string;
}

const PHASE_STYLES: Record<EventLoopPhase, string> = {
  timers: styles.timersTask,
  pending: styles.pendingTask,
  idle: styles.idleTask,
  poll: styles.pollTask,
  check: styles.checkTask,
  close: styles.closeTask,
};

const PHASE_NAMES: Record<EventLoopPhase, string> = {
  timers: "⏱ Timers",
  pending: "📋 Pending I/O",
  idle: "💤 Idle",
  poll: "📡 Poll",
  check: "✅ Check",
  close: "🔒 Close",
};

const SHOWN_PHASES: EventLoopPhase[] = ["timers", "poll", "check", "close"];

export const QueueDisplay = ({
  phaseQueues,
  currentPhase,
}: QueueDisplayProps) => {
  const renderTask = (task: Task, phase: EventLoopPhase) => (
    <div key={task.id} className={`${styles.task} ${PHASE_STYLES[phase]}`}>
      <div className={styles.taskHeader}>
        <span className={styles.taskType}>{task.type}</span>
        {task.delay !== undefined && (
          <span className={styles.taskDelay}>{task.delay}ms</span>
        )}
      </div>
      <div className={styles.taskCallback}>{task.callback}</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>📦 Macrotask Queues</div>
      </div>
      {SHOWN_PHASES.map((phase) => {
        const tasks = phaseQueues[phase];
        const isActive = currentPhase === phase;
        return (
          <div
            key={phase}
            className={`${styles.queueSection} ${isActive ? styles.activePhase : ""}`}
          >
            <div className={styles.queueHeader}>
              <span className={styles.queueTitle}>{PHASE_NAMES[phase]}</span>
              <span className={styles.queueCount}>{tasks.length}</span>
            </div>
            <div className={styles.taskList}>
              {tasks.length > 0 ? (
                tasks.slice(0, 5).map((t) => renderTask(t, phase))
              ) : (
                <div className={styles.emptyQueue}>Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
