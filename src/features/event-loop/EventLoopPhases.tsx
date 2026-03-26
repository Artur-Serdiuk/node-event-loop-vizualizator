import type { EventLoopState } from "../../types/eventLoop";
import { PHASE_ORDER } from "../../core/eventLoopSimulator";
import { EventLoopIcon } from "./EventLoopIcon";
import { PhaseNode } from "./PhaseNode";
import styles from "./EventLoopPhases.module.css";

interface EventLoopPhasesProps {
  state: EventLoopState;
}

/** Build a curved arc path between two angles on a circle */
function arcArrow(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
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
          <EventLoopIcon />
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
          const angle = (i * 360) / phaseCount - 90;
          const rad = angle * (Math.PI / 180);
          const radius = 38;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);

          return (
            <PhaseNode
              key={phase}
              phase={phase}
              isActive={state.currentPhase === phase}
              x={x}
              y={y}
            />
          );
        })}
      </div>
    </div>
  );
};
