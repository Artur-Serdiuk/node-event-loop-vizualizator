import { useEventLoop } from "../../hooks/useEventLoop";
import type { CodeStatement } from "../../types/eventLoop";
import { QueueDisplay } from "./QueueDisplay";
import { MicrotaskDisplay } from "./MicrotaskDisplay";
import { ControlPanel } from "../controls/ControlPanel";
import { CodeEditor } from "../code-editor/CodeEditor";
import { CallStack } from "./CallStack";
import { EventLoopPhases } from "./EventLoopPhases";
import { ConsolePanel } from "../controls/ConsolePanel";
import { ExecutionLog } from "./ExecutionLog";
import styles from "./EventLoopVisualizer.module.css";

export const EventLoopVisualizer = () => {
  const { state, loadCode, step, play, pause, reset, setSpeed, speed } =
    useEventLoop();

  const handleLoadCode = (statements: CodeStatement[], code: string) => {
    loadCode(statements, code);
  };

  const isCodeLoaded = state.codeStatements.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>⚡ Node.js Event Loop Visualizer</div>
          <div className={styles.subtitle}>
            Interactive step-by-step visualization
          </div>
        </div>
        <ControlPanel
          isRunning={state.isRunning}
          isPaused={state.isPaused}
          finished={state.finished}
          speed={speed}
          codeFullyRead={state.codeFullyRead}
          isCodeLoaded={isCodeLoaded}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSpeedChange={setSpeed}
        />
      </div>

      <div className={styles.code}>
        <CodeEditor
          onLoadCode={handleLoadCode}
          onReset={reset}
          highlightLines={state.highlightLines}
          codeFullyRead={state.codeFullyRead}
          isCodeLoaded={isCodeLoaded}
          sourceCode={state.sourceCode}
        />
      </div>

      <div className={styles.phases}>
        <EventLoopPhases state={state} />
      </div>

      <div className={styles.macro}>
        <QueueDisplay
          phaseQueues={state.phaseQueues}
          currentPhase={state.currentPhase}
        />
      </div>

      <div className={styles.micro}>
        <MicrotaskDisplay microtasks={state.microtasks} />
      </div>

      <div className={styles.stack}>
        <CallStack
          callStack={state.callStack}
          tick={state.tick}
          iteration={state.currentIteration}
        />
      </div>

      <div className={styles.console}>
        <ConsolePanel outputs={state.consoleOutput} />
      </div>

      <div className={styles.execlog}>
        <ExecutionLog history={state.executionHistory} />
      </div>
    </div>
  );
};
