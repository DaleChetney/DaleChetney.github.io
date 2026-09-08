import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/permutations";
import { actionArrows, ARROW_WIDTH, arrowStrokeWidths, layoutOrbits, NODE_RADIUS } from "./layout";

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

describe("arrowStrokeWidths", () => {
  // Two generators of different conjugate C_4 subgroups. Both contain the
  // 4-cycle (4 5 6 7), so four of each one's six arrows trace the same paths.
  const overlapping = [
    [1, 3, 2, 5, 6, 7, 4], // (2 3)(4 5 6 7)
    [2, 1, 3, 5, 6, 7, 4], // (1 2)(4 5 6 7)
  ];
  const overlapDiagram = layoutOrbits([
    [1, 2, 3],
    [4, 5, 6, 7],
  ]);
  const overlapArrows = actionArrows(overlapDiagram, overlapping, new Set([0, 1]));

  it("leaves an arrow that shares no path at the base width", () => {
    const single = actionArrows(overlapDiagram, overlapping, new Set([0]));
    expect(arrowStrokeWidths(single).every((w) => w === ARROW_WIDTH)).toBe(true);
  });

  it("returns one width per arrow", () => {
    expect(arrowStrokeWidths(overlapArrows)).toHaveLength(overlapArrows.length);
  });

  it("widens all but the last arrow on a shared path", () => {
    const widths = arrowStrokeWidths(overlapArrows);
    // 12 arrows: four shared paths carrying two each, plus four unshared.
    expect(widths.filter((w) => w === ARROW_WIDTH)).toHaveLength(8);
    expect(widths.filter((w) => w > ARROW_WIDTH)).toHaveLength(4);
  });

  it("gives every arrow on a shared path a distinct width", () => {
    const shared = overlapArrows
      .map((arrow, i) => ({ arrow, width: arrowStrokeWidths(overlapArrows)[i] }))
      .filter(({ arrow }) => arrow.from.point === 4 && arrow.to.point === 5)
      .map(({ width }) => width);
    expect(shared).toHaveLength(2);
    expect(new Set(shared).size).toBe(2);
  });

  it("handles no arrows", () => {
    expect(arrowStrokeWidths([])).toEqual([]);
  });
});
