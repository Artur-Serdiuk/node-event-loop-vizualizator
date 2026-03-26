import type { EventLoopPhase } from "../../types/eventLoop";
import { PHASE_LABELS, PHASE_APIS } from "../../core/eventLoopSimulator";
import styles from "./EventLoopPhases.module.css";

const PHASE_CSS: Record<EventLoopPhase, string> = {
  timers: styles.timers,
  pending: styles.pending,
  idle: styles.idle,
  poll: styles.poll,
  check: styles.check,
  close: styles.close,
};

interface PhaseNodeProps {
  phase: EventLoopPhase;
  isActive: boolean;
  x: number;
  y: number;
}

/**
 * A single phase node positioned on the event loop ring.
 */
export const PhaseNode = ({ phase, isActive, x, y }: PhaseNodeProps) => (
  <div
    className={`${styles.phase} ${PHASE_CSS[phase]} ${isActive ? styles.active : ""}`}
    style={{ left: `${x}%`, top: `${y}%` }}
  >
    <div className={styles.phaseLabel}>{PHASE_LABELS[phase]}</div>
    <div className={styles.phaseApi}>{PHASE_APIS[phase][0]}</div>
  </div>
);
