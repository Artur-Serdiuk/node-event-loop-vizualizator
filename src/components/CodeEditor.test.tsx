// @vitest-environment jsdom
import "../test-setup";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";
import { codeExamples } from "../data/examples";

afterEach(() => cleanup());

describe("CodeEditor", () => {
  const defaultProps = {
    onLoadCode: vi.fn(),
    onReset: vi.fn(),
    highlightLines: null,
    codeFullyRead: false,
    isCodeLoaded: false,
    sourceCode: "console.log('test');",
  };

  it("renders the editor when not in reading mode", () => {
    render(<CodeEditor {...defaultProps} />);
    // Simple code editor renders a textarea
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeTruthy();
  });

  it("renders readonly code view when in reading mode", () => {
    render(<CodeEditor {...defaultProps} isCodeLoaded={true} />);
    // Should not render textbox, should render the sourceCode lines
    expect(screen.queryByRole("textbox")).toBeNull();
    // It should render line number 1
    const { container } = render(
      <CodeEditor {...defaultProps} isCodeLoaded={true} />,
    );
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("console.log('test');");
  });

  it("disables run button when code is empty", () => {
    render(<CodeEditor {...defaultProps} />);
    const runBtn = screen.getByText("▶ Run Code").closest("button")!;
    expect(runBtn.disabled).toBe(true);
  });

  it("loads an example from the dropdown", () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByRole("combobox");

    // Select the first example
    fireEvent.change(select, { target: { value: codeExamples[0].id } });

    // The textbox should now contain the example's code
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(codeExamples[0].code);
  });

  it("calls onLoadCode when Run Code is clicked", () => {
    const onLoadCodeMock = vi.fn();
    render(<CodeEditor {...defaultProps} onLoadCode={onLoadCodeMock} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: codeExamples[0].id } });

    const runBtn = screen.getByText("▶ Run Code");
    fireEvent.click(runBtn);

    expect(onLoadCodeMock).toHaveBeenCalledTimes(1);
    expect(onLoadCodeMock).toHaveBeenCalledWith(
      expect.any(Array),
      codeExamples[0].code,
    );
  });

  it("shows error for invalid code", () => {
    render(<CodeEditor {...defaultProps} />);
    const textarea = screen.getByRole("textbox");

    // Type invalid code
    fireEvent.change(textarea, { target: { value: "const a = ;" } });

    // The error message should appear
    expect(screen.getByText(/⚠/i)).toBeTruthy();

    // Run button should be disabled
    const runBtn = screen.getByText("▶ Run Code").closest("button")!;
    expect(runBtn.disabled).toBe(true);
  });
});
