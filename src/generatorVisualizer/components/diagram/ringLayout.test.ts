import { describe, it, expect } from "vitest";
import { NODE_RADIUS, MIN_NODE_SPACING } from "./node";
import {
  diagramWidthShare,
  layoutOrbits,
  RING_SLOWDOWN,
  ringRates,
  ringCounts,
  stepRings,
  canCenter,
  fitRings,
} from "./ringLayout";

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

  describe("turned", () => {
    const twelve = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    /** Each point's clockwise angle about its ring's centre, in turns. */
    const angles = (turns: number[], rings = 1): Map<number, number> => {
      const diagram = layoutOrbits([twelve], 640, [rings], [turns]);
      const [cx, cy] = [diagram.width / 2, diagram.height / 2];
      return new Map(
        diagram.points.map((p) => [p.point, Math.atan2(p.y - cy, p.x - cx) / (2 * Math.PI)]),
      );
    };
    /** How far a point has moved clockwise from one angle to another, in turns, in [0, 1). */
    const swept = (from = 0, to = 0): number => (((to - from) % 1) + 1) % 1;

    it("leaves the layout where it was at no turn, and at a whole turn", () => {
      const still = layoutOrbits([twelve], 640);
      expect(layoutOrbits([twelve], 640, [], [[0]])).toEqual(still);
      layoutOrbits([twelve], 640, [], [[1]]).points.forEach((p, i) => {
        expect(p.x).toBeCloseTo(still.points[i].x);
        expect(p.y).toBeCloseTo(still.points[i].y);
      });
    });

    it("turns a single ring clockwise by its turn", () => {
      const [before, after] = [angles([0]), angles([0.1])];
      for (const point of twelve) {
        expect(swept(before.get(point), after.get(point))).toBeCloseTo(0.1);
      }
    });

    it("turns each ring by its own turn alone", () => {
      // Three rings of four, outermost first: 1-4, then 5-8, then 9-12.
      const [before, after] = [angles([0, 0, 0], 3), angles([0.3, 0.1, 0], 3)];
      const sweep = (point: number): number => swept(before.get(point), after.get(point));
      expect(sweep(1)).toBeCloseTo(0.3);
      expect(sweep(5)).toBeCloseTo(0.1);
      expect(sweep(9)).toBeCloseTo(0);
    });

    it("turns only the orbit it is given a turn for", () => {
      const still = layoutOrbits([twelve, [13, 14, 15]], 640);
      const turned = layoutOrbits([twelve, [13, 14, 15]], 640, [], [[], [0.2]]);
      const at = (diagram: typeof still, point: number) =>
        diagram.points.find((p) => p.point === point);
      expect(at(turned, 1)).toEqual(at(still, 1));
      expect(at(turned, 13)).not.toEqual(at(still, 13));
    });

    it("keeps every node inside the bounds as it turns", () => {
      const diagram = layoutOrbits([twelve, [13, 14, 15]], 640, [2], [[0.37, 0.1], [0.8]]);
      for (const { x, y } of diagram.points) {
        expect(x - NODE_RADIUS).toBeGreaterThanOrEqual(0);
        expect(y - NODE_RADIUS).toBeGreaterThanOrEqual(0);
        expect(x + NODE_RADIUS).toBeLessThanOrEqual(diagram.width);
        expect(y + NODE_RADIUS).toBeLessThanOrEqual(diagram.height);
      }
    });
  });

  describe("rings", () => {
    it("reports each ring's points, outermost first, about the orbit's centre", () => {
      const diagram = layoutOrbits([ring(1, 12)], 640, [3], [[0.2, 0.1, 0.05]]);
      expect(diagram.rings.map((r) => [r.orbit, r.ring, r.points])).toEqual([
        [0, 0, [1, 2, 3, 4]],
        [0, 1, [5, 6, 7, 8]],
        [0, 2, [9, 10, 11, 12]],
      ]);
      for (const placed of diagram.rings) {
        expect(placed.cx).toBeCloseTo(diagram.width / 2);
        expect(placed.cy).toBeCloseTo(diagram.height / 2);
        for (const point of placed.points) {
          const at = diagram.points.find((p) => p.point === point);
          expect(Math.hypot((at?.x ?? 0) - placed.cx, (at?.y ?? 0) - placed.cy)).toBeCloseTo(
            placed.radius,
          );
        }
      }
      const radii = diagram.rings.map((r) => r.radius);
      expect([...radii].sort((a, b) => b - a)).toEqual(radii);
    });

    it("gives each orbit its own centre, and an unsplit orbit one ring", () => {
      const diagram = layoutOrbits([ring(1, 3), ring(4, 4)]);
      expect(diagram.rings.map((r) => r.points)).toEqual([
        [1, 2, 3],
        [4, 5, 6, 7],
      ]);
      expect(diagram.rings[0].cx).toBeLessThan(diagram.rings[1].cx);
    });
  });

  it("centres a singleton orbit rather than ringing it", () => {
    const diagram = layoutOrbits([[1]]);
    expect(diagram.points).toHaveLength(1);
    expect(diagram.points[0].y).toBeCloseTo(diagram.height / 2);
  });
});

describe("ringRates", () => {
  it("turns a lone ring at the full rate", () => {
    expect(ringRates(1)).toEqual([1]);
  });

  it("slows each ring outward by a fixed share, the outermost listed first", () => {
    const [outer, middle, inner] = ringRates(3);
    expect(inner).toBe(1);
    expect(middle).toBeCloseTo(RING_SLOWDOWN);
    expect(outer).toBeCloseTo(RING_SLOWDOWN ** 2);
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

describe("ringCounts", () => {
  it("offers the divisors that leave at least two nodes a ring", () => {
    expect(ringCounts(8)).toEqual([1, 2, 4]);
    expect(ringCounts(12)).toEqual([1, 2, 3, 4]);
    expect(ringCounts(9)).toEqual([1, 3]);
  });

  it("stops at five rings", () => {
    expect(ringCounts(60)).toEqual([1, 2, 3, 4, 5]);
    expect(ringCounts(24)).toEqual([1, 2, 3, 4]);
  });

  it("offers only the one ring to a prime orbit, or one too small to split", () => {
    expect(ringCounts(7)).toEqual([1]);
    expect(ringCounts(4)).toEqual([1, 2]);
    expect(ringCounts(2)).toEqual([1]);
    expect(ringCounts(1)).toEqual([1]);
  });
});

describe("stepRings", () => {
  it("skips the counts that do not divide the orbit", () => {
    expect(stepRings(24, 1, 1)).toBe(2);
    expect(stepRings(24, 2, 1)).toBe(3);
    expect(stepRings(9, 1, 1)).toBe(3);
    expect(stepRings(9, 3, -1)).toBe(1);
  });

  it("stays put at either end", () => {
    expect(stepRings(12, 4, 1)).toBe(4);
    expect(stepRings(12, 1, -1)).toBe(1);
    expect(stepRings(7, 1, 1)).toBe(1);
  });
});

describe("layoutOrbits split into concentric rings", () => {
  /** Where the ring holding `orbit` is centred: the middle of its points' bounding box. */
  const distancesFromCentre = (diagram: ReturnType<typeof layoutOrbits>, orbit: number[]) => {
    const placed = diagram.points.filter((p) => orbit.includes(p.point));
    const xs = placed.map((p) => p.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = diagram.height / 2;
    return new Map(placed.map((p) => [p.point, Math.hypot(p.x - cx, p.y - cy)]));
  };

  it("puts each run of slots on its own ring, the first outermost", () => {
    const diagram = layoutOrbits([ring(1, 12)], 900, [3]);
    const radius = distancesFromCentre(diagram, ring(1, 12));
    const radii = (points: number[]) => points.map((p) => radius.get(p) ?? NaN);
    for (const run of [ring(1, 4), ring(5, 4), ring(9, 4)]) {
      expect(distinct(radii(run).map((r) => r.toFixed(3)))).toBe(1);
    }
    expect(radius.get(1)).toBeGreaterThan(radius.get(5) ?? Infinity);
    expect(radius.get(5)).toBeGreaterThan(radius.get(9) ?? Infinity);
  });

  it("lines each slot up with the ones inside it", () => {
    const diagram = layoutOrbits([ring(1, 8)], 900, [2]);
    const at = (point: number) => diagram.points.find((p) => p.point === point);
    // Slot j of each run sits at the same angle, so 1 is straight above 5.
    expect(at(1)?.x).toBeCloseTo(at(5)?.x ?? NaN);
    expect(at(1)?.y).toBeLessThan(at(5)?.y ?? -Infinity);
  });

  it("still spreads to about the width asked for", () => {
    for (const target of [600, 1200]) {
      const diagram = layoutOrbits([ring(1, 3), ring(4, 12)], target, [1, 2]);
      expect(diagram.width, `target ${String(target)}`).toBeCloseTo(target, 0);
    }
  });

  it("never puts two nodes on top of each other, at any width or split", () => {
    for (const target of [120, 600, 1600]) {
      for (const split of [2, 3, 4, 5]) {
        const diagram = layoutOrbits([ring(1, 60)], target, [split]);
        expect(closestPair(diagram), `${String(split)} rings at ${String(target)}`).toBeGreaterThan(
          NODE_RADIUS * 2,
        );
      }
    }
  });

  it("spaces the rings further apart when there is room to", () => {
    /** The radial distance between the outermost ring and the one inside it. */
    const gap = (target: number): number => {
      const diagram = layoutOrbits([ring(1, 12)], target, [3]);
      const radius = distancesFromCentre(diagram, ring(1, 12));
      return (radius.get(1) ?? NaN) - (radius.get(5) ?? NaN);
    };
    expect(gap(1400)).toBeGreaterThan(gap(700) * 1.5);
    // Cramped, the rings still keep a node's width and more between them.
    expect(gap(100)).toBeGreaterThan(NODE_RADIUS * 2);
  });

  it("spaces the rings as far apart as the neighbours around them", () => {
    const diagram = layoutOrbits([ring(1, 12)], 1400, [3]);
    const radius = distancesFromCentre(diagram, ring(1, 12));
    const radial = (radius.get(5) ?? NaN) - (radius.get(9) ?? NaN);
    // The innermost ring's arc between neighbours is 2πr / 4.
    const arc = (2 * Math.PI * (radius.get(9) ?? NaN)) / 4;
    expect(radial).toBeCloseTo(arc, 1);
  });

  it("draws a count that does not divide the orbit as one ring", () => {
    expect(layoutOrbits([ring(1, 9)], 900, [2])).toEqual(layoutOrbits([ring(1, 9)], 900));
  });
});

describe("a center node", () => {
  it("splits what is left once one node takes the center", () => {
    expect(ringCounts(7)).toEqual([1]);
    expect(ringCounts(7, true)).toEqual([1, 2, 3]);
    expect(ringCounts(13, true)).toEqual([1, 2, 3, 4]);
    expect(ringCounts(12, true)).toEqual([1]);
    expect(stepRings(7, 1, 1, true)).toBe(2);
  });

  it("is offered only when the rest still make a ring", () => {
    expect(canCenter(2)).toBe(false);
    expect(canCenter(3)).toBe(true);
    expect(ringCounts(2, true)).toEqual(ringCounts(2));
  });

  it("falls back to the most rings that still divide, no more than before", () => {
    expect(fitRings(12, 3, true)).toBe(1);
    expect(fitRings(13, 4, true)).toBe(4);
    expect(fitRings(13, 3, false)).toBe(1);
    expect(fitRings(16, 5, true)).toBe(5);
    expect(fitRings(16, 5, false)).toBe(4);
  });

  it("puts the last slot at the center and rings the rest", () => {
    const diagram = layoutOrbits([ring(1, 7)], 600, [2], [], [true]);
    const center = diagram.rings[0];
    const seven = diagram.points.find((p) => p.point === 7);
    expect(seven?.x).toBeCloseTo(center.cx);
    expect(seven?.y).toBeCloseTo(center.cy);
    expect(diagram.rings.map((r) => r.points)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(diagram.rings[2]).toMatchObject({ ring: 2, radius: 0 });
    expect(closestPair(diagram)).toBeGreaterThan(NODE_RADIUS * 2);
  });

  it("keeps the innermost ring as far from the center as the rings are from each other", () => {
    for (const target of [300, 600, 1400]) {
      const diagram = layoutOrbits([ring(1, 7)], target, [2], [], [true]);
      const [outer, inner] = diagram.rings;
      expect(inner.radius, `at ${String(target)}`).toBeCloseTo(outer.radius - inner.radius);
    }
  });

  it("still spreads to about the width asked for", () => {
    for (const [size, rings] of [
      [7, 2],
      [13, 3],
      [41, 2],
    ]) {
      const diagram = layoutOrbits([ring(1, size)], 900, [rings], [], [true]);
      expect(diagram.width, `${String(size)} as ${String(rings)}`).toBeCloseTo(900, 0);
    }
  });

  it("is ignored on an orbit too small to ring the rest", () => {
    expect(layoutOrbits([ring(1, 2)], 600, [1], [], [true])).toEqual(
      layoutOrbits([ring(1, 2)], 600),
    );
  });
});
