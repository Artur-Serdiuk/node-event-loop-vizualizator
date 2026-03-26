import type { MicrotaskQueue } from "../../types/eventLoop";
import styles from "./MicrotaskDisplay.module.css";

interface MicrotaskQueueSectionProps {
  title: string;
  tasks: MicrotaskQueue["nextTick"];
  taskClassName: string;
}

const MicrotaskQueueSection = ({
  title,
  tasks,
  taskClassName,
}: MicrotaskQueueSectionProps) => (
  <div className={styles.queue}>
    <div className={styles.queueHeader}>
      <span className={styles.queueTitle}>{title}</span>
      <span className={styles.queueCount}>{tasks.length}</span>
    </div>
    <div className={styles.taskList}>
      {tasks.length > 0 ? (
        tasks.map((task) => (
          <div key={task.id} className={`${styles.task} ${taskClassName}`}>
            {task.callback}
          </div>
        ))
      ) : (
        <div className={styles.emptyQueue}>Empty</div>
      )}
    </div>
  </div>
);

interface MicrotaskDisplayProps {
  microtasks: MicrotaskQueue;
}

export const MicrotaskDisplay = ({ microtasks }: MicrotaskDisplayProps) => (
  <div className={styles.container}>
    <div className={styles.header}>
      <div className={styles.title}>⚡ Microtask Queue</div>
    </div>

    <div className={styles.queues}>
      <MicrotaskQueueSection
        title="🔔 process.nextTick"
        tasks={microtasks.nextTick}
        taskClassName={styles.nextTickTask}
      />
      <MicrotaskQueueSection
        title="🤝 Promise.then"
        tasks={microtasks.promises}
        taskClassName={styles.promiseTask}
      />
    </div>
  </div>
);
