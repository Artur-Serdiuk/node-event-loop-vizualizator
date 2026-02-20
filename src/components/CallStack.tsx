import styles from "./CallStack.module.css";

interface CallStackProps {
  callStack: string[];
  tick: number;
  iteration: number;
}

export const CallStack = ({ callStack, tick, iteration }: CallStackProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>📚 Call Stack</div>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            Tick: <span className={styles.metaValue}>{tick}</span>
          </span>
          <span className={styles.metaItem}>
            Iteration: <span className={styles.metaValue}>{iteration}</span>
          </span>
        </div>
      </div>
      <div className={styles.content}>
        {callStack.length > 0 ? (
          callStack.map((item, i) => (
            <div key={`${tick}-${i}`} className={styles.stackItem}>
              {item}
            </div>
          ))
        ) : (
          <div className={styles.emptyStack}>Stack is empty</div>
        )}
      </div>
    </div>
  );
};
