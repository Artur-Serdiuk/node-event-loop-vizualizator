import { describe, it, expect } from "vitest";
import {
  PHASE_ORDER,
  PHASE_LABELS,
  PHASE_DESCRIPTIONS,
  PHASE_APIS,
  PHASE_COLORS,
} from "./eventLoopSimulator";

describe("eventLoopSimulator constants", () => {
  describe("PHASE_ORDER", () => {
    it("contains exactly 6 phases in correct order", () => {
      expect(PHASE_ORDER).toEqual([
        "timers",
        "pending",
        "idle",
        "poll",
        "check",
        "close",
      ]);
    });

    it("has no duplicates", () => {
      const unique = new Set(PHASE_ORDER);
      expect(unique.size).toBe(PHASE_ORDER.length);
    });
  });

  describe("PHASE_LABELS", () => {
    it("has a non-empty label for every phase", () => {
      for (const phase of PHASE_ORDER) {
        expect(PHASE_LABELS[phase]).toBeTruthy();
        expect(typeof PHASE_LABELS[phase]).toBe("string");
      }
    });
  });

  describe("PHASE_DESCRIPTIONS", () => {
    it("has a description for every phase", () => {
      for (const phase of PHASE_ORDER) {
        expect(PHASE_DESCRIPTIONS[phase]).toBeTruthy();
      }
    });

    it("has a description for microtask", () => {
      expect(PHASE_DESCRIPTIONS["microtask"]).toBeTruthy();
    });
  });

  describe("PHASE_APIS", () => {
    it("has a non-empty API list for every phase", () => {
      for (const phase of PHASE_ORDER) {
        expect(PHASE_APIS[phase].length).toBeGreaterThan(0);
      }
    });

    it("has APIs for microtask", () => {
      expect(PHASE_APIS["microtask"].length).toBeGreaterThan(0);
      expect(PHASE_APIS["microtask"]).toContain("process.nextTick()");
      expect(PHASE_APIS["microtask"]).toContain("Promise.then()");
    });
  });

  describe("PHASE_COLORS", () => {
    it("has a valid hex color for every phase", () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      for (const phase of PHASE_ORDER) {
        expect(PHASE_COLORS[phase]).toMatch(hexRegex);
      }
    });

    it("has a color for microtask", () => {
      expect(PHASE_COLORS["microtask"]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
