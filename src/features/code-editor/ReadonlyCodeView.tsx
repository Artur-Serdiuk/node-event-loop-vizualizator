import { useMemo } from "react";
import { highlight, languages } from "prismjs";
import styles from "./CodeEditor.module.css";

interface ReadonlyCodeViewProps {
  sourceCode: string;
  highlightLines: { start: number; end: number } | null;
  codeFullyRead: boolean;
}

/**
 * Read-only code display with line-by-line highlighting during code reading.
 */
export const ReadonlyCodeView = ({
  sourceCode,
  highlightLines,
  codeFullyRead,
}: ReadonlyCodeViewProps) => {
  const codeLines = useMemo(() => sourceCode.split("\n"), [sourceCode]);

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

        return (
          <div
            key={idx}
            className={`${styles.codeLine} ${
              isHighlighted
                ? styles.codeLineHighlighted
                : isAlreadyRead || codeFullyRead
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
