import { useState, useEffect, useMemo } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";
import { parseCodeToStatements } from "../../utils/codeParser";
import type { CodeStatement } from "../../types/eventLoop";
import { codeExamples, getExampleById } from "../../data/examples";
import styles from "./CodeEditor.module.css";

interface CodeEditorProps {
  onLoadCode: (statements: CodeStatement[], code: string) => void;
  onReset: () => void;
  highlightLines: { start: number; end: number } | null;
  codeFullyRead: boolean;
  isCodeLoaded: boolean;
  sourceCode: string;
}

export const CodeEditor = ({
  onLoadCode,
  onReset,
  highlightLines,
  codeFullyRead,
  isCodeLoaded,
  sourceCode,
}: CodeEditorProps) => {
  const [code, setCode] = useState("");
  const [selectedExample, setSelectedExample] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code.trim()) {
      const result = parseCodeToStatements(code);
      setError(result.errors.length > 0 ? result.errors[0] : null);
    } else {
      setError(null);
    }
  }, [code]);

  const handleRunCode = () => {
    if (isReadingMode) {
      onReset();
    }
    const result = parseCodeToStatements(code);
    if (result.errors.length > 0) {
      setError(result.errors[0]);
      return;
    }
    setError(null);
    onLoadCode(result.statements, code);
  };

  const handleExampleChange = (exampleId: string) => {
    setSelectedExample(exampleId);
    if (exampleId) {
      const example = getExampleById(exampleId);
      if (example) {
        if (isReadingMode) {
          onReset();
        }
        setCode(example.code);
      }
    }
  };

  const currentExample = selectedExample
    ? getExampleById(selectedExample)
    : null;

  // When code is loaded (reading mode), render a read-only view with line highlighting
  const isReadingMode = isCodeLoaded;
  const displayCode = isReadingMode ? sourceCode : code;

  const codeLines = useMemo(() => {
    return displayCode.split("\n");
  }, [displayCode]);

  const renderReadonlyCode = () => {
    return (
      <div className={styles.readonlyCode}>
        {codeLines.map((line, idx) => {
          const lineNum = idx + 1;
          const isHighlighted =
            highlightLines !== null &&
            lineNum >= highlightLines.start &&
            lineNum <= highlightLines.end;
          const isAlreadyRead =
            highlightLines !== null && lineNum < highlightLines.start;
          const isFullyRead = codeFullyRead;

          return (
            <div
              key={idx}
              className={`${styles.codeLine} ${
                isHighlighted
                  ? styles.codeLineHighlighted
                  : isAlreadyRead || isFullyRead
                    ? styles.codeLineRead
                    : styles.codeLinePending
              }`}
            >
              <span className={styles.lineNumber}>{lineNum}</span>
              <span
                className={styles.lineContent}
                dangerouslySetInnerHTML={{
                  __html: highlight(
                    line || " ",
                    languages.javascript,
                    "javascript",
                  ),
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

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

      {currentExample && !isReadingMode && (
        <div className={styles.description}>{currentExample.description}</div>
      )}

      <div className={styles.editorWrapper}>
        {isReadingMode ? (
          renderReadonlyCode()
        ) : (
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
        )}
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
