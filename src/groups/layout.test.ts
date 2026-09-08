import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/permutations";
import { actionArrows, layoutOrbits, NODE_RADIUS } from "./layout";

const distinct = <T>(values: readonly T[]): number => new Set(values).size;

describe("layoutOrbits", () => {
  it("places every point of every orbit exactly once", () => {
    const diagram = layoutOrbits([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);
    expect(diagram.points.map((p) => p.point).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("gives distinct positions to distinct points", () => {
    const diagram = layoutOrbits([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]);
    expect(distinct(diagram.points.map((p) => `${p.x},${p.y}`))).toBe(12);
  });

  it("separates orbits horizontally", () => {
    const diagram = layoutOrbits([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);
    const first = diagram.points.filter((p) => p.point <= 3);
    const second = diagram.points.filter((p) => p.point >= 4);
    expect(Math.max(...first.map((p) => p.x))).toBeLessThan(Math.min(...second.map((p) => p.x)));
  });

  it("keeps every node inside the reported bounds", () => {
    const diagram = layoutOrbits([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);
    for (const { x, y } of diagram.points) {
      expect(x - NODE_RADIUS).toBeGreaterThanOrEqual(0);
      expect(y - NODE_RADIUS).toBeGreaterThanOrEqual(0);
      expect(x + NODE_RADIUS).toBeLessThanOrEqual(diagram.width);
      expect(y + NODE_RADIUS).toBeLessThanOrEqual(diagram.height);
    }
  });

  it("centres a singleton orbit rather than ringing it", () => {
    const diagram = layoutOrbits([[1]]);
    expect(diagram.points).toHaveLength(1);
    expect(diagram.points[0].y).toBeCloseTo(diagram.height / 2);
  });
});

describe("actionArrows", () => {
  const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
  const diagram = layoutOrbits(permutationOrbits(generators, 7));

  it("emits nothing when no generator is selected", () => {
    expect(actionArrows(diagram, generators, new Set())).toEqual([]);
  });

  it("emits one arrow per moved point", () => {
    // Generator 0 is (2 3)(4 5 6 7): six moved points, one fixed.
    const arrows = actionArrows(diagram, generators, new Set([0]));
    expect(arrows).toHaveLength(6);
    expect(arrows.every((a) => a.from.point !== a.to.point)).toBe(true);
  });

  it("skips fixed points", () => {
    const arrows = actionArrows(diagram, generators, new Set([2])); // (1 2 3)
    expect(arrows.map((a) => a.from.point).sort()).toEqual([1, 2, 3]);
  });

  it("tags each arrow with the generator that produced it", () => {
    const arrows = actionArrows(diagram, generators, new Set([0, 2]));
    expect(distinct(arrows.map((a) => a.generator))).toBe(2);
    expect(arrows).toHaveLength(9); // 6 from (2 3)(4 5 6 7), 3 from (1 2 3)
  });
});
