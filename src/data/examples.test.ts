import { describe, it, expect } from "vitest";
import { codeExamples, getExampleById, getExampleTitles } from "./examples";
import { parseCode } from "../utils/codeParser";

describe("examples", () => {
  describe("codeExamples", () => {
    it("is a non-empty array", () => {
      expect(codeExamples.length).toBeGreaterThan(0);
    });

    it("every example has required fields", () => {
      for (const ex of codeExamples) {
        expect(ex.id).toBeTruthy();
        expect(ex.title).toBeTruthy();
        expect(ex.description).toBeTruthy();
        expect(ex.code).toBeTruthy();
      }
    });

    it("every example has a unique id", () => {
      const ids = codeExamples.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getExampleById", () => {
    it("returns the correct example for a valid id", () => {
      const first = codeExamples[0];
      const result = getExampleById(first.id);
      expect(result).toEqual(first);
    });

    it("returns undefined for a non-existent id", () => {
      expect(getExampleById("non-existent-id")).toBeUndefined();
    });
  });

  describe("getExampleTitles", () => {
    it("returns an array of { id, title } objects", () => {
      const titles = getExampleTitles();
      expect(titles.length).toBe(codeExamples.length);
      for (const t of titles) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("title");
      }
    });
  });

  describe("all examples parse without errors", () => {
    for (const example of codeExamples) {
      it(`"${example.title}" parses successfully`, () => {
        const result = parseCode(example.code);
        expect(result.errors).toEqual([]);
        expect(result.tasks.length + result.syncOutputs.length).toBeGreaterThan(
          0,
        );
      });
    }
  });
});
