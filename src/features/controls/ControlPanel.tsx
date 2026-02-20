import type { PlaybackSpeed } from "../../types/eventLoop";
import styles from "./ControlPanel.module.css";

interface ControlPanelProps {
  isRunning: boolean;
  isPaused: boolean;
  finished: boolean;
  speed: PlaybackSpeed;
  codeFullyRead: boolean;
  isCodeLoaded: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

export const ControlPanel = ({
  isRunning,
  isPaused,
  finished,
  speed,
  codeFullyRead,
  isCodeLoaded,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
}: ControlPanelProps) => {
  const isReadingCode = isCodeLoaded && !codeFullyRead;

  const statusText = finished
    ? "✓ Finished"
    : isReadingCode
      ? "📖 Reading Code"
      : isRunning && !isPaused
        ? "● Running"
        : isPaused
          ? "⏸ Paused"
          : "○ Ready";

  const statusClass = finished
    ? styles.statusFinished
    : isRunning && !isPaused
      ? styles.statusRunning
      : isPaused
        ? styles.statusPaused
        : styles.statusIdle;

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        {!isRunning || isPaused ? (
          <button
            className={`${styles.button} ${styles.playButton}`}
            onClick={onPlay}
            disabled={finished}
          >
            ▶ Play
          </button>
        ) : (
          <button
            className={`${styles.button} ${styles.pauseButton}`}
            onClick={onPause}
          >
            ⏸ Pause
          </button>
        )}

        <button
          className={`${styles.button} ${styles.stepButton}`}
          onClick={onStep}
          disabled={finished}
        >
          ⏭ Step
        </button>

        <button
          className={`${styles.button} ${styles.resetButton}`}
          onClick={onReset}
        >
          ↺ Reset
        </button>
      </div>

      <div className={styles.speedControl}>
        <span className={styles.speedLabel}>Speed</span>
        <div className={styles.speedButtons}>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`${styles.speedBtn} ${speed === s ? styles.speedBtnActive : ""}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className={styles.status}>
        <span className={`${styles.statusDot} ${statusClass}`} />
        {statusText}
      </div>
    </div>
  );
};
