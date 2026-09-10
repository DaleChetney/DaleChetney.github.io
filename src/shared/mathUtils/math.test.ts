import { describe, it, expect } from "vitest";
import { clamp, primeDivisorCount } from "@shared/mathUtils/math";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to the bounds", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("primeDivisorCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [6, 2],
    [12, 3],
    [64, 6],
  ])("counts %i with multiplicity as %i", (n, expected) => {
    expect(primeDivisorCount(n)).toBe(expected);
  });
});
