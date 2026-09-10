import { describe, it, expect } from "vitest";
import { NODE_RADIUS, MIN_NODE_SPACING } from "./node";
import { diagramWidthShare, layoutOrbits } from "./ringLayout";

const distinct = <T>(values: readonly T[]): number => new Set(values).size;

const ring = (start: number, size: number): number[] =>
  Array.from({ length: size }, (_, i) => start + i);

/** Distance between neighbours on the ring holding `orbit`. */
const neighbourGap = (
  orbit: readonly number[],
  diagram: { points: { point: number; x: number; y: number }[] },
): number => {
  const at = (point: number) => {
    const placed = diagram.points.find((p) => p.point === point);
    if (placed === undefined) throw new Error(`point ${point} is not placed`);
    return placed;
  };
  const [a, b] = [at(orbit[0]), at(orbit[1])];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** The closest any two nodes come to each other, centre to centre. */
const closestPair = (diagram: { points: { x: number; y: number }[] }): number => {
  let min = Infinity;
  diagram.points.forEach((a, i) => {
    for (const b of diagram.points.slice(i + 1))
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
  });
  return min;
};

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

describe("diagramWidthShare", () => {
  it("gives a single ring 40% of the panel", () => {
    expect(diagramWidthShare(1)).toBeCloseTo(0.4);
  });

  it("adds 10% for each ring after the first", () => {
    expect(diagramWidthShare(2)).toBeCloseTo(0.5);
    expect(diagramWidthShare(4)).toBeCloseTo(0.7);
  });

  it("reaches the whole panel at seven rings and stops there", () => {
    expect(diagramWidthShare(7)).toBeCloseTo(1);
    expect(diagramWidthShare(12)).toBeCloseTo(1);
  });
});

describe("layoutOrbits scaled to a target width", () => {
  const orbits = [ring(1, 3), ring(4, 4)];

  it("spreads out to about the width asked for", () => {
    for (const target of [500, 900, 1400]) {
      expect(layoutOrbits(orbits, target).width, `target ${String(target)}`).toBeCloseTo(target, 0);
    }
  });

  it("spreads the points apart rather than growing them", () => {
    const narrow = layoutOrbits(orbits, 500);
    const wide = layoutOrbits(orbits, 1000);
    // Nothing about a node's own size depends on the width it is drawn at.
    expect(closestPair(wide)).toBeGreaterThan(closestPair(narrow) * 1.5);
    expect(NODE_RADIUS).toBe(17);
  });

  it("keeps neighbours about as far apart on a small ring as on a large one", () => {
    const diagram = layoutOrbits([ring(1, 3), ring(4, 12)], 1200);
    const small = neighbourGap(ring(1, 3), diagram);
    const large = neighbourGap(ring(4, 12), diagram);
    // Equal arc, so the chord on a 3-ring runs a little short; roughly is the
    // point, and within a quarter of each other is roughly.
    expect(small / large).toBeGreaterThan(0.75);
    expect(small / large).toBeLessThan(1.25);
  });

  it("draws wider than asked rather than crowding the nodes", () => {
    const crowded = layoutOrbits([ring(1, 24)], 200);
    expect(crowded.width).toBeGreaterThan(200);
    expect(closestPair(crowded)).toBeGreaterThan(NODE_RADIUS * 2);
  });

  it("never puts two nodes on top of each other, at any width", () => {
    for (const target of [120, 400, 900, 1600]) {
      const diagram = layoutOrbits([ring(1, 2), ring(3, 5), ring(8, 9)], target);
      expect(closestPair(diagram), `target ${String(target)}`).toBeGreaterThan(NODE_RADIUS * 2);
    }
  });

  it("falls back to the minimum spacing when no target is given", () => {
    const diagram = layoutOrbits([ring(1, 8)]);
    expect(layoutOrbits([ring(1, 8)], 0).width).toBe(diagram.width);
    expect(closestPair(diagram)).toBeGreaterThan(NODE_RADIUS * 2);
    expect(MIN_NODE_SPACING).toBeGreaterThan(NODE_RADIUS * 2);
  });
});
