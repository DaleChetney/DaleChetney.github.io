import { MIN_NODE_SPACING, NODE_RADIUS, type PlacedPoint } from "./node";
import type { Diagram } from "./permutationDiagram";

const MIN_RING_RADIUS = 44;
const RING_GAP = 54;
const MARGIN = 34;

/** The closest the concentric rings an orbit is split into are drawn, radially. */
const MIN_CONCENTRIC_GAP = NODE_RADIUS * 2 + 18;

/** The most concentric rings one orbit is split into. */
export const MAX_RINGS = 5;

/** The fewest nodes a ring may hold once an orbit is split: fewer is not a ring. */
const MIN_RING_SIZE = 3;

/**
 * How fast each concentric ring turns relative to the one just inside it:
 * the innermost turns at the full rate, and every ring outside it at this
 * share of the rate of the ring it encloses.
 */
export const RING_SLOWDOWN = 0.66;

/** Panel width to lay out against when the page has not been measured yet. */
export const DEFAULT_TARGET_WIDTH = 640;

/**
 * The numbers of concentric rings an orbit of `size` points can be split into,
 * ascending: the divisors of `size` up to {@link MAX_RINGS} that leave every
 * ring at least three nodes. One ring is always among them.
 */
export const ringCounts = (size: number): number[] =>
  Array.from({ length: MAX_RINGS }, (_, i) => i + 1).filter(
    (rings) => rings === 1 || (size % rings === 0 && size / rings >= MIN_RING_SIZE),
  );

/**
 * The ring count one step up or down from `current` for an orbit of `size`,
 * skipping the counts that do not divide it; `current` again at either end.
 */
export const stepRings = (size: number, current: number, step: 1 | -1): number => {
  const counts = ringCounts(size);
  const next = counts[counts.indexOf(current) + step] as number | undefined;
  return next ?? current;
};

/**
 * The share of the panel the diagram should fill: 40% for a single ring, and
 * another 10% for each ring after it, since every ring has to earn its own
 * width. Seven rings is the practical ceiling and takes the whole panel.
 */
export const diagramWidthShare = (rings: number): number =>
  Math.min(1, 0.4 + 0.1 * Math.max(rings - 1, 0));

/**
 * Radius of the ring holding `size` nodes at `spacing` arc length apart.
 *
 * Radius proportional to the number of nodes is what keeps neighbours the same
 * distance apart on a small ring as on a large one. It is the arc that is held
 * equal rather than the chord, which is close enough above three or four nodes
 * and cheap to compute; the floor keeps a 2-cycle from drawing on top of itself.
 */
const ringRadius = (size: number, spacing: number): number =>
  size <= 1 ? 0 : Math.max(MIN_RING_RADIUS, (size * spacing) / (2 * Math.PI));

/** Width a ring of this radius occupies, never less than a single node. */
const ringSpan = (radius: number): number => Math.max(radius * 2, NODE_RADIUS * 2);

/** How far apart neighbours sit around a ring, and how far apart its concentric rings sit. */
interface Spacing {
  arc: number;
  radial: number;
}

/**
 * The spacing that makes the rings fill `targetWidth` between them.
 *
 * Every innermost ring's radius is proportional to its size, and each ring
 * nested outside it adds the radial gap, so the widths add up to
 * `arc * Σ size / π + 2 * radial * Σ (rings - 1)`. The radial gap is kept equal
 * to the arc, so split rings spread apart as the room grows just as neighbours
 * do; only once the arc is too tight for that is the gap held at its floor and
 * the arc solved for alone. Nodes and arrows keep their own size whatever comes
 * out: widening the diagram spreads the points apart rather than magnifying them.
 */
const nodeSpacing = (
  orbits: readonly (readonly number[])[],
  rings: readonly number[],
  targetWidth: number | undefined,
): Spacing => {
  const perimeter =
    orbits.reduce((total, orbit, i) => total + orbit.length / rings[i], 0) / Math.PI;
  const nested = rings.reduce((total, count) => total + 2 * (count - 1), 0);
  const floor = { arc: MIN_NODE_SPACING, radial: MIN_CONCENTRIC_GAP };
  if (targetWidth === undefined || perimeter === 0) return floor;
  const available = targetWidth - RING_GAP * Math.max(orbits.length - 1, 0) - MARGIN * 2;

  const even = available / (perimeter + nested);
  if (even >= MIN_CONCENTRIC_GAP) return { arc: even, radial: even };
  const arc = (available - nested * MIN_CONCENTRIC_GAP) / perimeter;
  return { arc: Math.max(MIN_NODE_SPACING, arc), radial: MIN_CONCENTRIC_GAP };
};

/**
 * Place each orbit on its own ring, rings laid out left to right. Orbits are
 * drawn separately because a permutation representation need not be transitive:
 * the minimal faithful representation of `C_3:C_4` has degree 7 and splits as
 * 3 + 4, and drawing that as one ring would imply an adjacency that is not there.
 *
 * `rings[i]` splits orbit `i` into that many concentric rings of equal size,
 * taking its slots in runs: the first run is the outermost ring, and slot `j`
 * of every run sits at the same angle, so a point lines up with the ones
 * inside it. A count that does not divide the orbit is drawn as one ring.
 *
 * `targetWidth` is the width to spread out to. It is a target rather than a
 * bound: a ring crowded at that width is drawn wider instead of tighter.
 *
 * `turns[i]` is how far the innermost ring of orbit `i` has turned clockwise,
 * in whole turns; each ring outside it has turned {@link RING_SLOWDOWN} as far
 * as the ring inside it. An orbit drawn as one ring is its own innermost ring.
 */
export const layoutOrbits = (
  orbits: readonly (readonly number[])[],
  targetWidth?: number,
  rings: readonly number[] = [],
  turns: readonly number[] = [],
): Diagram => {
  const counts = orbits.map((orbit, i) =>
    ringCounts(orbit.length).includes(rings[i] ?? 1) ? (rings[i] ?? 1) : 1,
  );
  const spacing = nodeSpacing(orbits, counts, targetWidth);
  // The innermost ring is sized as a lone ring of its size would be; the rest nest outside it.
  const outerRadii = orbits.map(
    (orbit, i) =>
      ringRadius(orbit.length / counts[i], spacing.arc) + spacing.radial * (counts[i] - 1),
  );

  const width =
    outerRadii.reduce((total, radius) => total + ringSpan(radius), 0) +
    RING_GAP * Math.max(orbits.length - 1, 0) +
    MARGIN * 2;
  const height = Math.max(...outerRadii.map(ringSpan), NODE_RADIUS * 2) + MARGIN * 2;

  const points: PlacedPoint[] = [];
  let cursor = MARGIN;
  orbits.forEach((orbit, ringIndex) => {
    const outer = outerRadii[ringIndex];
    const perRing = orbit.length / counts[ringIndex];
    const centerX = cursor + ringSpan(outer) / 2;
    cursor += ringSpan(outer) + RING_GAP;
    orbit.forEach((point, i) => {
      const ring = Math.floor(i / perRing);
      const radius = outer - spacing.radial * ring;
      const turned = (turns[ringIndex] ?? 0) * RING_SLOWDOWN ** (counts[ringIndex] - 1 - ring);
      // Start at the top and run clockwise, so a cycle reads the way it is written.
      const angle = -Math.PI / 2 + 2 * Math.PI * ((i % perRing) / perRing + turned);
      points.push({
        point,
        x: centerX + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      });
    });
  });

  return { points, width, height };
};
