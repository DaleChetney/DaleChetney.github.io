import type { Permutation } from "@shared/mathUtils/groups/permutations";

/** A point of the permutation domain, placed in diagram coordinates. */
export interface PlacedPoint {
  point: number;
  x: number;
  y: number;
}

/** A generator's action on one point, as an edge between two placed points. */
export interface ActionArrow {
  /** Index into the representation's generator list. */
  generator: number;
  from: PlacedPoint;
  to: PlacedPoint;
}

export interface Diagram {
  points: PlacedPoint[];
  width: number;
  height: number;
}

export const NODE_RADIUS = 17;

const RING_PADDING = 13;
const MIN_RING_RADIUS = 44;
const RING_GAP = 54;
const MARGIN = 34;

/** Closest two neighbours on a ring are ever drawn, as arc length. */
export const MIN_NODE_SPACING = NODE_RADIUS * 2 + RING_PADDING;

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
  const ringSpan = (radius: number): number => Math.max(radius * 2, NODE_RADIUS * 2);

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

/**
 * Arrows for the action of the selected generators, one per moved point.
 * Fixed points are skipped: an arrow from a node to itself carries no
 * information the node's absence of an arrow does not already give.
 */
export const actionArrows = (
  diagram: Diagram,
  generators: readonly Permutation[],
  selected: ReadonlySet<number>,
): ActionArrow[] => {
  const byPoint = new Map(diagram.points.map((placed) => [placed.point, placed]));
  const arrows: ActionArrow[] = [];
  generators.forEach((generator, index) => {
    if (!selected.has(index)) return;
    for (const placed of diagram.points) {
      const image = generator[placed.point - 1];
      if (image === placed.point) continue;
      const target = byPoint.get(image);
      if (target === undefined) continue;
      arrows.push({ generator: index, from: placed, to: target });
    }
  });
  return arrows;
};

/** Stroke width of an arrow that shares its path with no other. */
export const ARROW_WIDTH = 2.2;

/** How much wider each further arrow on a shared path is drawn. */
const ARROW_WIDTH_STEP = 1.3;

/**
 * Stroke widths, aligned with `arrows`. Different generators can send the same
 * point to the same image, and those arrows trace the same curve exactly. Rather
 * than hide all but the last, the ones sharing a path are widened in steps so
 * that drawing widest-first leaves each visible as a band inside the one behind
 * it. The shared path is the honest picture: it really is one map, induced by
 * several generators.
 */
export const arrowStrokeWidths = (arrows: readonly ActionArrow[]): number[] => {
  const bundles = new Map<string, number>();
  const pathKey = (arrow: ActionArrow): string => `${arrow.from.point}->${arrow.to.point}`;
  for (const arrow of arrows) {
    bundles.set(pathKey(arrow), (bundles.get(pathKey(arrow)) ?? 0) + 1);
  }
  const drawn = new Map<string, number>();
  return arrows.map((arrow) => {
    const key = pathKey(arrow);
    const position = drawn.get(key) ?? 0;
    drawn.set(key, position + 1);
    const remaining = (bundles.get(key) ?? 1) - 1 - position;
    return ARROW_WIDTH + remaining * ARROW_WIDTH_STEP;
  });
};
