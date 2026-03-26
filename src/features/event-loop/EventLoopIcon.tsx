import styles from "./EventLoopPhases.module.css";

/**
 * Animated two-arrow icon displayed at the center of the event loop ring.
 */
export const EventLoopIcon = () => (
  <svg className={styles.centerIcon} viewBox="0 0 48 48" width="40" height="40">
    <defs>
      <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowYellow" x="-50%" y="-50%" width="200%" height="200%">
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
);
