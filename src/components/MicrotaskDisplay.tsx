import type { MicrotaskQueue, Task } from "../types/eventLoop";
import styles from "./MicrotaskDisplay.module.css";

interface MicrotaskDisplayProps {
  microtasks: MicrotaskQueue;
}

export const MicrotaskDisplay = ({ microtasks }: MicrotaskDisplayProps) => {
  const renderTask = (task: Task, cls: string) => (
    <div key={task.id} className={`${styles.task} ${cls}`}>
      {task.callback}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>⚡ Microtask Queue</div>
      </div>

      <div className={styles.queues}>
        <div className={styles.queue}>
          <div className={styles.queueHeader}>
            <span className={styles.queueTitle}>🔔 process.nextTick</span>
            <span className={styles.queueCount}>
              {microtasks.nextTick.length}
            </span>
          </div>
          <div className={styles.taskList}>
            {microtasks.nextTick.length > 0 ? (
              microtasks.nextTick.map((t) => renderTask(t, styles.nextTickTask))
            ) : (
              <div className={styles.emptyQueue}>Empty</div>
            )}
          </div>
        </div>

        <div className={styles.queue}>
          <div className={styles.queueHeader}>
            <span className={styles.queueTitle}>🤝 Promise.then</span>
            <span className={styles.queueCount}>
              {microtasks.promises.length}
            </span>
          </div>
          <div className={styles.taskList}>
            {microtasks.promises.length > 0 ? (
              microtasks.promises.map((t) => renderTask(t, styles.promiseTask))
            ) : (
              <div className={styles.emptyQueue}>Empty</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
