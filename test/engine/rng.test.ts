import { describe, expect, it } from "vitest";
import { createRngSeed, nextRngFloat, nextRngIntInclusive, shuffleWithRng } from "@/lib/engine/rng";

describe("RNG", () => {
  describe("createRngSeed", () => {
    it("returns a non-negative integer", () => {
      const seed = createRngSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    });
  });

  describe("nextRngFloat", () => {
    it("returns a value in [0, 1)", () => {
      let state = 12345;
      for (let i = 0; i < 100; i++) {
        const result = nextRngFloat(state);
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThan(1);
        state = result.rngState;
      }
    });

    it("produces deterministic output for the same state", () => {
      const a = nextRngFloat(99999);
      const b = nextRngFloat(99999);
      expect(a.value).toBe(b.value);
      expect(a.rngState).toBe(b.rngState);
    });
  });

  describe("nextRngIntInclusive", () => {
    it("returns integers within the requested range", () => {
      let state = 42;
      for (let i = 0; i < 200; i++) {
        const result = nextRngIntInclusive(state, 1, 6);
        expect(Number.isInteger(result.value)).toBe(true);
        expect(result.value).toBeGreaterThanOrEqual(1);
        expect(result.value).toBeLessThanOrEqual(6);
        state = result.rngState;
      }
    });

    it("handles reversed min/max gracefully", () => {
      const result = nextRngIntInclusive(42, 10, 5);
      expect(result.value).toBeGreaterThanOrEqual(5);
      expect(result.value).toBeLessThanOrEqual(10);
    });

    it("handles non-finite inputs gracefully", () => {
      const result = nextRngIntInclusive(42, NaN, 5);
      expect(Number.isInteger(result.value)).toBe(true);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(5);
    });
  });

  describe("shuffleWithRng", () => {
    it("shuffles deterministically with the same seed", () => {
      const list = [1, 2, 3, 4, 5];
      const a = shuffleWithRng(list, 12345);
      const b = shuffleWithRng(list, 12345);
      expect(a.list).toEqual(b.list);
      expect(a.rngState).toBe(b.rngState);
    });

    it("produces a different order with a different seed", () => {
      const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const a = shuffleWithRng(list, 11111);
      const b = shuffleWithRng(list, 22222);
      expect(a.list).not.toEqual(b.list);
    });

    it("returns the same list for a single element", () => {
      const list = [42];
      const result = shuffleWithRng(list, 12345);
      expect(result.list).toEqual([42]);
    });

    it("returns an empty list for empty input", () => {
      const result = shuffleWithRng([], 12345);
      expect(result.list).toEqual([]);
    });
  });
});
