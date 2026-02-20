import { useEffect, useRef } from "react";
import type { ExecutionHistoryItem } from "../types/eventLoop";
import styles from "./ExecutionLog.module.css";

interface ExecutionLogProps {
  history: ExecutionHistoryItem[];
}

const PHASE_CSS: Record<string, string> = {
  sync: styles.phaseSync,
  microtask: styles.phaseMicrotask,
  timers: styles.phaseTimers,
  check: styles.phaseCheck,
  poll: styles.phasePoll,
  close: styles.phaseClose,
  pending: styles.phasePending,
};

export const ExecutionLog = ({ history }: ExecutionLogProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>📋 Execution Log</div>
        <span className={styles.count}>{history.length}</span>
      </div>
      <div className={styles.list}>
        {history.length > 0 ? (
          history.map((item) => (
            <div key={item.id} className={styles.item}>
              <span className={styles.tick}>t{item.tick}</span>
              <span
                className={`${styles.phase} ${PHASE_CSS[item.phase] || ""}`}
              >
                {item.phase}
              </span>
              <span className={styles.label}>{item.label}</span>
            </div>
          ))
        ) : (
          <div className={styles.emptyList}>No tasks executed yet</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
