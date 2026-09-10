import { describe, it, expect } from "vitest";
import { Rng } from "@shared/mathUtils/rng";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("produces floats in [0, 1)", () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("reproduces the reference mulberry32 stream for a known seed", () => {
    const rng = new Rng(42);
    expect(rng.next()).toBeCloseTo(0.60110375192, 9);
    expect(rng.next()).toBeCloseTo(0.448290558998, 9);
    expect(rng.next()).toBeCloseTo(0.85246579349, 9);
  });

  it("actually varies rather than repeating one value", () => {
    const rng = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.next());
    expect(seen.size).toBe(1000);
  });

  it("int() stays within the inclusive range and returns integers", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it("pick() throws on an empty array", () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it("pick() returns a member of the array", () => {
    const items = ["a", "b", "c"] as const;
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});
