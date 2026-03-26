import { useState, useMemo } from "react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";
import { parseCodeToStatements } from "../../utils/codeParser";
import type { CodeStatement } from "../../types/eventLoop";
import { getExampleById } from "../../data/examples";
import { ReadonlyCodeView } from "./ReadonlyCodeView";
import { ExampleSelector } from "./ExampleSelector";
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

  const parsedCode = useMemo(() => {
    if (!code.trim()) return { statements: [], error: null };
    const result = parseCodeToStatements(code);
    return {
      statements: result.statements,
      error: result.errors.length > 0 ? result.errors[0] : null,
    };
  }, [code]);

  const error = parsedCode.error;
  const isReadingMode = isCodeLoaded;
  const currentExample = selectedExample
    ? getExampleById(selectedExample)
    : null;
  const description = currentExample?.description ?? null;

  const handleRunCode = () => {
    if (isReadingMode) onReset();
    if (error) return;
    onLoadCode(parsedCode.statements, code);
  };

  const handleExampleChange = (exampleId: string) => {
    setSelectedExample(exampleId);
    if (!exampleId) return;
    const example = getExampleById(exampleId);
    if (!example) return;
    if (isReadingMode) onReset();
    setCode(example.code);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>📝 Code</div>
        <ExampleSelector
          selectedExample={selectedExample}
          onExampleChange={handleExampleChange}
        />
      </div>

      {description && !isReadingMode && (
        <div className={styles.description}>{description}</div>
      )}

      <div className={styles.editorWrapper}>
        {isReadingMode ? (
          <ReadonlyCodeView
            sourceCode={sourceCode}
            highlightLines={highlightLines}
            codeFullyRead={codeFullyRead}
          />
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
