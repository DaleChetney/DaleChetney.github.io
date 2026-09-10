import { MIN_NODE_SPACING, NODE_RADIUS, type PlacedPoint } from "./node";
import type { Diagram } from "./permutationDiagram";

const MIN_RING_RADIUS = 44;
const RING_GAP = 54;
const MARGIN = 34;

/** Panel width to lay out against when the page has not been measured yet. */
export const DEFAULT_TARGET_WIDTH = 640;

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
 * The spacing that makes the rings fill `targetWidth` between them.
 *
 * Every ring's radius is proportional to its size, so the widths add up to
 * `spacing * degree / π` and the spacing that fills a target follows directly.
 * Nodes and arrows keep their own size whatever comes out: widening the diagram
 * spreads the points apart rather than magnifying them.
 */
const nodeSpacing = (
  orbits: readonly (readonly number[])[],
  targetWidth: number | undefined,
): number => {
  const degree = orbits.reduce((total, orbit) => total + orbit.length, 0);
  if (targetWidth === undefined || degree === 0) return MIN_NODE_SPACING;
  const available = targetWidth - RING_GAP * Math.max(orbits.length - 1, 0) - MARGIN * 2;
  return Math.max(MIN_NODE_SPACING, (Math.PI * available) / degree);
};

/**
 * Place each orbit on its own ring, rings laid out left to right. Orbits are
 * drawn separately because a permutation representation need not be transitive:
 * the minimal faithful representation of `C_3:C_4` has degree 7 and splits as
 * 3 + 4, and drawing that as one ring would imply an adjacency that is not there.
 *
 * `targetWidth` is the width to spread out to. It is a target rather than a
 * bound: a ring crowded at that width is drawn wider instead of tighter.
 */
export const layoutOrbits = (
  orbits: readonly (readonly number[])[],
  targetWidth?: number,
): Diagram => {
  const spacing = nodeSpacing(orbits, targetWidth);
  const radii = orbits.map((orbit) => ringRadius(orbit.length, spacing));

  const width =
    radii.reduce((total, radius) => total + ringSpan(radius), 0) +
    RING_GAP * Math.max(orbits.length - 1, 0) +
    MARGIN * 2;
  const height = Math.max(...radii.map(ringSpan), NODE_RADIUS * 2) + MARGIN * 2;

  const points: PlacedPoint[] = [];
  let cursor = MARGIN;
  orbits.forEach((orbit, ringIndex) => {
    const radius = radii[ringIndex];
    const centerX = cursor + ringSpan(radius) / 2;
    cursor += ringSpan(radius) + RING_GAP;
    orbit.forEach((point, i) => {
      // Start at the top and run clockwise, so a cycle reads the way it is written.
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / orbit.length;
      points.push({
        point,
        x: centerX + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      });
    });
  });

  return { points, width, height };
};
