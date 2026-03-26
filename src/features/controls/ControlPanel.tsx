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

  const getStatus = () => {
    if (finished)
      return { text: "✓ Finished", className: styles.statusFinished };
    if (isReadingCode)
      return { text: "📖 Reading Code", className: styles.statusIdle };
    if (isRunning && !isPaused)
      return { text: "● Running", className: styles.statusRunning };
    if (isPaused) return { text: "⏸ Paused", className: styles.statusPaused };
    return { text: "○ Ready", className: styles.statusIdle };
  };

  const status = getStatus();

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
        <span className={`${styles.statusDot} ${status.className}`} />
        {status.text}
      </div>
    </div>
  );
};
