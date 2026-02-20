import { useState, useEffect } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";
import { parseCode } from "../utils/codeParser";
import type { Task, ConsoleOutput } from "../types/eventLoop";
import { codeExamples, getExampleById } from "../data/examples";
import styles from "./CodeEditor.module.css";

interface CodeEditorProps {
  onRunCode: (tasks: Task[], syncOutputs: ConsoleOutput[]) => void;
}

export const CodeEditor = ({ onRunCode }: CodeEditorProps) => {
  const [code, setCode] = useState("");
  const [selectedExample, setSelectedExample] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code.trim()) {
      const result = parseCode(code);
      setError(result.errors.length > 0 ? result.errors[0] : null);
    } else {
      setError(null);
    }
  }, [code]);

  const handleRunCode = () => {
    const result = parseCode(code);
    if (result.errors.length > 0) {
      setError(result.errors[0]);
      return;
    }
    setError(null);
    onRunCode(result.tasks, result.syncOutputs);
  };

  const handleExampleChange = (exampleId: string) => {
    setSelectedExample(exampleId);
    if (exampleId) {
      const example = getExampleById(exampleId);
      if (example) setCode(example.code);
    }
  };

  const currentExample = selectedExample
    ? getExampleById(selectedExample)
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>📝 Code</div>
        <div className={styles.exampleSelector}>
          <span className={styles.exampleLabel}>Examples:</span>
          <select
            className={styles.exampleSelect}
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
          >
            <option value="">Select example...</option>
            {codeExamples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentExample && (
        <div className={styles.description}>{currentExample.description}</div>
      )}

      <div className={styles.editorWrapper}>
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={(c) => highlight(c, languages.javascript, "javascript")}
          padding={16}
          className={styles.editor}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            backgroundColor: "#0d0d1e",
            color: "#d4d4d4",
          }}
        />
      </div>

      {error && <div className={styles.error}>⚠ {error}</div>}

      <div className={styles.actions}>
        <div className={styles.validation}>
          {code.trim() && !error ? (
            <span className={styles.validationValid}>✓ Valid</span>
          ) : code.trim() && error ? (
            <span className={styles.validationInvalid}>✗ Error</span>
          ) : null}
        </div>
        <button
          className={styles.runButton}
          onClick={handleRunCode}
          disabled={!code.trim() || !!error}
        >
          ▶ Run Code
        </button>
      </div>
    </div>
  );
};
