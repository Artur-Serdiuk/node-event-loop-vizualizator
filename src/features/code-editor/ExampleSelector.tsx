import { codeExamples } from "../../data/examples";
import styles from "./CodeEditor.module.css";

interface ExampleSelectorProps {
  selectedExample: string;
  onExampleChange: (exampleId: string) => void;
}

/**
 * Dropdown for selecting predefined code examples.
 */
export const ExampleSelector = ({
  selectedExample,
  onExampleChange,
}: ExampleSelectorProps) => (
  <div className={styles.exampleSelector}>
    <span className={styles.exampleLabel}>Examples:</span>
    <select
      className={styles.exampleSelect}
      value={selectedExample}
      onChange={(e) => onExampleChange(e.target.value)}
    >
      <option value="">Select example...</option>
      {codeExamples.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.title}
        </option>
      ))}
    </select>
  </div>
);
