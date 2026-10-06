import { describe, it, expect } from "vitest";
import { largestOrbitExponent, multiplicativeOrder, orbitsUnder } from "./autOrbits";

describe("multiplicativeOrder", () => {
  it("counts the steps ×m takes to come back to 1", () => {
    expect(multiplicativeOrder(3, 16)).toBe(4);
    expect(multiplicativeOrder(15, 16)).toBe(2);
    expect(multiplicativeOrder(3, 31)).toBe(30);
  });
});

describe("largestOrbitExponent", () => {
  it("picks the exponent of largest order", () => {
    expect(largestOrbitExponent(16, [15, 3])).toBe(3);
    expect(largestOrbitExponent(32, [31, 5])).toBe(5);
  });

  it("keeps LMFDB's first on a tie", () => {
    expect(largestOrbitExponent(24, [17, 13, 19])).toBe(17);
  });

  it("has nothing to pick for a group without automorphisms", () => {
    expect(largestOrbitExponent(2, [])).toBeUndefined();
  });
});

describe("orbitsUnder", () => {
  it("walks the chosen exponent innermost, then each other one over what it reached", () => {
    expect(orbitsUnder(16, [15, 3], 3)).toEqual([
      [1, 3, 9, 11],
      [15, 13, 7, 5],
    ]);
    expect(orbitsUnder(16, [15, 3], 15)).toEqual([
      [1, 15],
      [3, 13],
      [9, 7],
      [11, 5],
    ]);
  });

  it("splits into one orbit per coset when there are three exponents", () => {
    expect(orbitsUnder(24, [17, 13, 19], 13)).toEqual([
      [1, 13],
      [17, 5],
      [19, 7],
      [11, 23],
    ]);
  });

  it("reaches every unit exactly once", () => {
    const orbits = orbitsUnder(31, [3], 3);
    expect(orbits).toHaveLength(1);
    expect([...orbits[0]].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, k) => k + 1),
    );
  });

  it("gives the lone generator of a group without automorphisms", () => {
    expect(orbitsUnder(2, [], undefined)).toEqual([[1]]);
  });
});
