import { useEffect, useRef } from "react";
import type { ConsoleOutput } from "../types/eventLoop";
import styles from "./ConsolePanel.module.css";

interface ConsolePanelProps {
  outputs: ConsoleOutput[];
}

const PHASE_CSS: Record<string, string> = {
  sync: styles.phaseSync,
  microtask: styles.phaseMicrotask,
  timers: styles.phaseTimers,
  check: styles.phaseCheck,
  poll: styles.phasePoll,
  close: styles.phaseClose,
};

export const ConsolePanel = ({ outputs }: ConsolePanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputs.length]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>🖥 Console Output</div>
        <span className={styles.count}>{outputs.length}</span>
      </div>
      <div className={styles.output}>
        {outputs.length > 0 ? (
          outputs.map((out, i) => (
            <div key={out.id} className={styles.line}>
              <span className={styles.lineNumber}>{i + 1}</span>
              <span
                className={`${styles.linePhase} ${PHASE_CSS[out.phase] || ""}`}
              >
                {out.phase === "sync" ? "SYNC" : out.phase.toUpperCase()}
              </span>
              <span className={styles.lineText}>{out.text}</span>
            </div>
          ))
        ) : (
          <div className={styles.emptyOutput}>
            Run code to see console output...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
