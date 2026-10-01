import { MIN_NODE_SPACING, NODE_RADIUS, type PlacedPoint } from "./node";
import type { Diagram, PlacedRing } from "./permutationDiagram";

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

/**
 * How far each of `rings` concentric rings turns while the innermost turns
 * once, the outermost ring first, as {@link layoutOrbits} numbers them.
 */
export const ringRates = (rings: number): number[] =>
  Array.from({ length: rings }, (_, ring) => RING_SLOWDOWN ** (rings - 1 - ring));

/** Panel width to lay out against when the page has not been measured yet. */
export const DEFAULT_TARGET_WIDTH = 640;

/**
 * Whether an orbit of `size` points can put one of them at its center: only if
 * the rest still make a ring.
 */
export const canCenter = (size: number): boolean => size - 1 >= MIN_RING_SIZE;

/**
 * The numbers of concentric rings an orbit of `size` points can be split into,
 * ascending: the divisors of `size` up to {@link MAX_RINGS} that leave every
 * ring at least three nodes. One ring is always among them. With a node at
 * the `center`, it is the rest that are split, so an orbit of 7 makes 2 rings of 3.
 */
export const ringCounts = (size: number, center = false): number[] => {
  const ringed = center && canCenter(size) ? size - 1 : size;
  return Array.from({ length: MAX_RINGS }, (_, i) => i + 1).filter(
    (rings) => rings === 1 || (ringed % rings === 0 && ringed / rings >= MIN_RING_SIZE),
  );
};

/**
 * The ring count one step up or down from `current` for an orbit of `size`,
 * skipping the counts that do not divide it; `current` again at either end.
 */
export const stepRings = (size: number, current: number, step: 1 | -1, center = false): number => {
  const counts = ringCounts(size, center);
  const next = counts[counts.indexOf(current) + step] as number | undefined;
  return next ?? current;
};

/**
 * The most rings, no more than `current`, an orbit of `size` can be split
 * into with or without a node at its `center`: what a count falls back to
 * when the center is taken or given back.
 */
export const fitRings = (size: number, current: number, center: boolean): number =>
  Math.max(...ringCounts(size, center).filter((rings) => rings <= current));

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

/**
 * Whether a ring of `size` nodes around a center node sits further out than
 * its size alone would put it: a radial gap from the center, where its arc
 * would leave it nearer. Taken where the gap and the arc are equal.
 */
const isHeldOut = (size: number): boolean => size / (2 * Math.PI) < 1;

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
 *
 * A node at the center counts as a ring of no radius, so the innermost ring is
 * kept a radial gap from it. A ring too small to reach that far on its own is
 * held there instead, and adds a radial gap, not its size, to the sum.
 */
const nodeSpacing = (
  ringed: readonly number[],
  rings: readonly number[],
  centers: readonly boolean[],
  targetWidth: number | undefined,
): Spacing => {
  const held = ringed.map((size, i) => centers[i] && isHeldOut(size / rings[i]));
  const perimeter =
    ringed.reduce((total, size, i) => total + (held[i] ? 0 : size / rings[i]), 0) / Math.PI;
  const nested = rings.reduce((total, count, i) => total + 2 * (count - (held[i] ? 0 : 1)), 0);
  const floor = { arc: MIN_NODE_SPACING, radial: MIN_CONCENTRIC_GAP };
  if (targetWidth === undefined || perimeter + nested === 0) return floor;
  const available = targetWidth - RING_GAP * Math.max(ringed.length - 1, 0) - MARGIN * 2;

  const even = available / (perimeter + nested);
  if (even >= MIN_CONCENTRIC_GAP) return { arc: even, radial: even };
  // With every ring held out from its center, the radial floor alone sets the width.
  if (perimeter === 0) return floor;
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
 * `turns[i][r]` is how far ring `r` of orbit `i` has turned clockwise, in
 * whole turns, the outermost ring first. Each ring turns on its own, and one
 * with no turn given sits where it started.
 *
 * `centered[i]` puts the last slot of orbit `i` at its center and rings the
 * rest, where the rest are enough to make a ring.
 *
 * Every ring is reported alongside the points, with its centre and the points
 * on it, so whatever turns a ring can tell which nodes go with it. A node at
 * the center is reported as one more ring, innermost, of no radius.
 */
export const layoutOrbits = (
  orbits: readonly (readonly number[])[],
  targetWidth?: number,
  rings: readonly number[] = [],
  turns: readonly (readonly number[])[] = [],
  centered: readonly boolean[] = [],
): Diagram => {
  const centers = orbits.map((orbit, i) => (centered[i] ?? false) && canCenter(orbit.length));
  const ringed = orbits.map((orbit, i) => orbit.length - (centers[i] ? 1 : 0));
  const counts = orbits.map((orbit, i) =>
    ringCounts(orbit.length, centers[i]).includes(rings[i] ?? 1) ? (rings[i] ?? 1) : 1,
  );
  const spacing = nodeSpacing(ringed, counts, centers, targetWidth);
  // The innermost ring is sized as a lone ring of its size would be, kept a
  // radial gap clear of any center node; the rest nest outside it.
  const outerRadii = ringed.map((size, i) => {
    const lone = ringRadius(size / counts[i], spacing.arc);
    const innermost = centers[i] ? Math.max(lone, spacing.radial) : lone;
    return innermost + spacing.radial * (counts[i] - 1);
  });

  const width =
    outerRadii.reduce((total, radius) => total + ringSpan(radius), 0) +
    RING_GAP * Math.max(orbits.length - 1, 0) +
    MARGIN * 2;
  const height = Math.max(...outerRadii.map(ringSpan), NODE_RADIUS * 2) + MARGIN * 2;

  const points: PlacedPoint[] = [];
  const placedRings: PlacedRing[] = [];
  let cursor = MARGIN;
  orbits.forEach((orbit, orbitIndex) => {
    const outer = outerRadii[orbitIndex];
    const perRing = ringed[orbitIndex] / counts[orbitIndex];
    const cx = cursor + ringSpan(outer) / 2;
    const cy = height / 2;
    cursor += ringSpan(outer) + RING_GAP;
    for (let ring = 0; ring < counts[orbitIndex]; ring++) {
      const radius = outer - spacing.radial * ring;
      const turned = turns[orbitIndex]?.[ring] ?? 0;
      const slots = orbit.slice(ring * perRing, (ring + 1) * perRing);
      slots.forEach((point, slot) => {
        // Start at the top and run clockwise, so a cycle reads the way it is written.
        const angle = -Math.PI / 2 + 2 * Math.PI * (slot / perRing + turned);
        points.push({ point, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      });
      placedRings.push({ orbit: orbitIndex, ring, cx, cy, radius, points: slots });
    }
    if (centers[orbitIndex]) {
      const center = orbit.slice(ringed[orbitIndex]);
      points.push({ point: center[0], x: cx, y: cy });
      placedRings.push({
        orbit: orbitIndex,
        ring: counts[orbitIndex],
        cx,
        cy,
        radius: 0,
        points: center,
      });
    }
  });

  return { points, rings: placedRings, width, height };
};
