import type { EventLoopState, EventLoopPhase } from "../../types/eventLoop";
import {
  PHASE_ORDER,
  PHASE_LABELS,
  PHASE_APIS,
} from "../../core/eventLoopSimulator";
import styles from "./EventLoopPhases.module.css";

interface EventLoopPhasesProps {
  state: EventLoopState;
}

const PHASE_CSS: Record<EventLoopPhase, string> = {
  timers: styles.timers,
  pending: styles.pending,
  idle: styles.idle,
  poll: styles.poll,
  check: styles.check,
  close: styles.close,
};

/** Build a curved arc path between two angles on a circle */
function arcArrow(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  // Inset the arc a bit so it doesn't touch the phase nodes
  const inset = 12;
  const s = (startDeg + inset) * (Math.PI / 180);
  const e = (endDeg - inset) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

export const EventLoopPhases = ({ state }: EventLoopPhasesProps) => {
  const isMicrotask = state.currentPhase === "microtask";
  const phaseCount = PHASE_ORDER.length;
  const svgSize = 300;
  const svgCenter = svgSize / 2;
  const arcRadius = 115;

  return (
    <div className={styles.container}>
      {isMicrotask && (
        <div className={styles.microtaskIndicator}>
          ⚡ Draining Microtask Queue
        </div>
      )}

      <div className={styles.ring}>
        {/* Center label */}
        <div className={styles.centerLabel}>
          <svg
            className={styles.centerIcon}
            viewBox="0 0 48 48"
            width="40"
            height="40"
          >
            <defs>
              {/* Animated glow filter for arrow 1 (red) */}
              <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="glowYellow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Top arrow (red) — curves right-to-left */}
            <path
              d="M 34 18 A 13 13 0 0 0 14 18"
              fill="none"
              stroke="#f87171"
              strokeWidth="3"
              strokeLinecap="round"
              className={styles.arrow1}
            />
            <polygon
              points="12,12 17,21 7,21"
              fill="#f87171"
              className={styles.arrow1}
            />

            {/* Bottom arrow (yellow) — curves left-to-right */}
            <path
              d="M 14 30 A 13 13 0 0 0 34 30"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeLinecap="round"
              className={styles.arrow2}
            />
            <polygon
              points="36,36 31,27 41,27"
              fill="#fbbf24"
              className={styles.arrow2}
            />
          </svg>
          <div className={styles.centerText}>Event Loop</div>
        </div>

        {/* SVG curved arrows */}
        <svg className={styles.arrowsSvg} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(148,163,184,0.5)" />
            </marker>
          </defs>
          {PHASE_ORDER.map((_, i) => {
            const startAngle = (i * 360) / phaseCount - 90;
            const endAngle = ((i + 1) * 360) / phaseCount - 90;
            const d = arcArrow(
              svgCenter,
              svgCenter,
              arcRadius,
              startAngle,
              endAngle,
            );
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(148,163,184,0.2)"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </svg>

        {/* Phase nodes */}
        {PHASE_ORDER.map((phase, i) => {
          const isActive = state.currentPhase === phase;
          const angle = (i * 360) / phaseCount - 90;
          const rad = angle * (Math.PI / 180);
          const radius = 38;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);

          return (
            <div
              key={phase}
              className={`${styles.phase} ${PHASE_CSS[phase]} ${isActive ? styles.active : ""}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
              }}
            >
              <div className={styles.phaseLabel}>{PHASE_LABELS[phase]}</div>
              <div className={styles.phaseApi}>{PHASE_APIS[phase][0]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
