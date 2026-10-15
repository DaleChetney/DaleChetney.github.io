import type { Permutation } from "@shared/mathUtils/groups/permutations";
import { svg } from "../../svg";
import { NODE_RADIUS, type PlacedPoint } from "./node";

/** A generator's action on one point, as an edge between two placed points. */
export interface ActionArrow {
  /** Index into the representation's generator list. */
  generator: number;
  from: PlacedPoint;
  to: PlacedPoint;
}

/**
 * Arrows for the action of the generators being drawn, one per moved point.
 * Fixed points are skipped: an arrow from a node to itself carries no
 * information the node's absence of an arrow does not already give.
 */
export const actionArrows = (
  points: readonly PlacedPoint[],
  generators: readonly Permutation[],
): ActionArrow[] => {
  const byPoint = new Map(points.map((placed) => [placed.point, placed]));
  const arrows: ActionArrow[] = [];
  generators.forEach((generator, index) => {
    for (const placed of points) {
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
const ARROW_WIDTH = 2.2;

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
const strokeWidths = (arrows: readonly ActionArrow[]): number[] => {
  const pathKey = (arrow: ActionArrow): string => `${arrow.from.point}->${arrow.to.point}`;
  const bundles = new Map<string, number>();
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

/**
 * How an arrow's bow grows with the length of its chord. "constant" caps it, so
 * every arrow past a modest length bows by the same amount; "relative" lets it
 * keep growing in proportion, so long arrows bow as visibly as short ones.
 */
export type BowWidth = "constant" | "relative";

/** How far an arrow bows away from the straight chord at curvature 1, in user units. */
const bowOffset = (distance: number, width: BowWidth): number =>
  (width === "constant" ? Math.min(distance * 0.18, 34) : distance * 0.18) + 6;

const arrowheadId = (generator: number): string => `arrowhead-${generator}`;

const midArrowheadId = (generator: number): string => `arrowhead-mid-${generator}`;

/**
 * Below this distance between two nodes' centers, an arrow is drawn as its head
 * alone, halfway between them. Close nodes leave too little room between their
 * circles for a stroke to read as more than a smudge under the head.
 */
export const HEAD_ONLY_DISTANCE = 45;

/**
 * How much of the curve, as a fraction of it, a head-only arrow's path keeps
 * before the midpoint. The path is never seen; it only has to point the head
 * along the curve.
 */
const HEAD_ONLY_SPAN = 0.01;

interface Point {
  x: number;
  y: number;
}

/** Where the arrow's bowed curve bends towards, between the two node centers. */
const controlPoint = (
  arrow: Pick<ActionArrow, "from" | "to">,
  curvature: number,
  width: BowWidth,
): Point => {
  const dx = arrow.to.x - arrow.from.x;
  const dy = arrow.to.y - arrow.from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const offset = bowOffset(distance, width) * curvature;
  return {
    x: (arrow.from.x + arrow.to.x) / 2 - (dy / distance) * offset,
    y: (arrow.from.y + arrow.to.y) / 2 + (dx / distance) * offset,
  };
};

const isHeadOnly = (arrow: Pick<ActionArrow, "from" | "to">): boolean =>
  Math.hypot(arrow.to.x - arrow.from.x, arrow.to.y - arrow.from.y) < HEAD_ONLY_DISTANCE;

/**
 * Where an arrow's head is drawn: at the end of its stroke, touching the node
 * it points to, or halfway along it, clear of both nodes.
 */
export type HeadPosition = "end" | "middle";

/**
 * The piece of the quadratic from `start` through `control` to `end` that runs
 * from t0 to t1, as a quadratic of its own: its start, control and end. Each
 * point is the original's three weighted by the Bernstein blend of t0 and t1.
 */
const quadraticPiece = (
  start: Point,
  control: Point,
  end: Point,
  t0: number,
  t1: number,
): [Point, Point, Point] => {
  const at = (u: number, v: number): Point => {
    const weights = [(1 - u) * (1 - v), u * (1 - v) + (1 - u) * v, u * v];
    return {
      x: weights[0] * start.x + weights[1] * control.x + weights[2] * end.x,
      y: weights[0] * start.y + weights[1] * control.y + weights[2] * end.y,
    };
  };
  return [at(t0, t0), at(t0, t1), at(t1, t1)];
};

/**
 * A quadratic curve from one node's boundary to another's. Arrows bow to one
 * side so that a 2-cycle's two arrows separate instead of overlapping, and both
 * ends are pulled back to the node boundary so the head is not hidden under it.
 * `curvature` scales the bow: 0 is the straight chord, and a negative value
 * bows to the other side. `width` sets how the bow grows with the chord.
 *
 * With the head in the middle, the curve is split there into two quadratics,
 * so the head can sit on the vertex between them; and it stops as short of the
 * node it points to as of the one it leaves, with no head to make room for.
 */
export const arrowPath = (
  arrow: Pick<ActionArrow, "from" | "to">,
  curvature: number,
  width: BowWidth = "constant",
  head: HeadPosition = "end",
): string => {
  const control = controlPoint(arrow, curvature, width);

  const pullBack = (node: PlacedPoint, gap: number): Point => {
    const toControlX = control.x - node.x;
    const toControlY = control.y - node.y;
    const length = Math.hypot(toControlX, toControlY) || 1;
    return {
      x: node.x + (toControlX / length) * gap,
      y: node.y + (toControlY / length) * gap,
    };
  };

  const start = pullBack(arrow.from, NODE_RADIUS + 2);
  const end = pullBack(arrow.to, head === "end" ? NODE_RADIUS + 8 : NODE_RADIUS + 2);
  if (head === "end") {
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  const [, first, middle] = quadraticPiece(start, control, end, 0, 0.5);
  const [, second] = quadraticPiece(start, control, end, 0.5, 1);
  return (
    `M ${start.x} ${start.y} Q ${first.x} ${first.y} ${middle.x} ${middle.y}` +
    ` Q ${second.x} ${second.y} ${end.x} ${end.y}`
  );
};

/**
 * The short piece of the center-to-center curve that ends at its midpoint. A
 * head-only arrow draws this unstroked, so that the head sits halfway along
 * where the stroke would have run, pointing the way it would have pointed, and
 * a 2-cycle's two heads stay on their own sides.
 */
const headOnlyPath = (
  arrow: Pick<ActionArrow, "from" | "to">,
  curvature: number,
  width: BowWidth,
): string => {
  const control = controlPoint(arrow, curvature, width);
  const [start, middle, end] = quadraticPiece(
    arrow.from,
    control,
    arrow.to,
    0.5 - HEAD_ONLY_SPAN,
    0.5,
  );
  return `M ${start.x} ${start.y} Q ${middle.x} ${middle.y} ${end.x} ${end.y}`;
};

/**
 * Give a drawn arrow its shape for where its nodes now are: the full stroke
 * with its head where `head` puts it, or, between close nodes, the head alone
 * at the midpoint. Run on every move, since a turn of the rings can carry two
 * nodes across the threshold either way. Every attribute it touches is set
 * each time, never removed, so a moved arrow matches a freshly drawn one.
 */
export const shapeArrow = (
  path: SVGPathElement,
  arrow: ActionArrow,
  curvature = 1,
  width: BowWidth = "constant",
  head: HeadPosition = "end",
): void => {
  const endHead = `url(#${arrowheadId(arrow.generator)})`;
  const midHead = `url(#${midArrowheadId(arrow.generator)})`;
  const headOnly = isHeadOnly(arrow);
  path.setAttribute(
    "d",
    headOnly ? headOnlyPath(arrow, curvature, width) : arrowPath(arrow, curvature, width, head),
  );
  path.setAttribute("stroke-opacity", headOnly ? "0" : "1");
  path.setAttribute("marker-mid", !headOnly && head === "middle" ? midHead : "none");
  path.setAttribute("marker-end", headOnly ? midHead : head === "end" ? endHead : "none");
};

/**
 * One arrowhead marker per generator drawn. Markers cannot be styled by the
 * path that uses them, so each generator needs its own in the color of its
 * edges.
 */
export const arrowheadDefs = (
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
): SVGDefsElement => {
  const defs = svg("defs");
  for (const generator of new Set(arrows.map((arrow) => arrow.generator))) {
    // The end-of-stroke head puts its tip at the path's end; the middle one
    // centers itself on its vertex instead, so it sits squarely between the nodes.
    for (const [id, refX] of [
      [arrowheadId(generator), 9],
      [midArrowheadId(generator), 5],
    ] as const) {
      const marker = svg("marker", {
        id,
        viewBox: "0 0 10 10",
        refX,
        refY: 5,
        markerWidth: 5,
        markerHeight: 5,
        orient: "auto-start-reverse",
      });
      marker.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: colorOf(generator) }));
      defs.append(marker);
    }
  }
  return defs;
};

/**
 * The edge layer: every arrow as a curve, tagged with the action it stands for.
 * `curvature` is how far the arrows bow, as a multiple of the usual amount,
 * `width` how that bow grows with an arrow's length, and `head` where along it
 * the head is drawn.
 */
export const renderArrows = (
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
  curvature = 1,
  width: BowWidth = "constant",
  head: HeadPosition = "end",
): SVGGElement => {
  const edges = svg("g", { class: "edges", fill: "none" });
  const widths = strokeWidths(arrows);
  // Widest first, so an arrow sharing a path is drawn over the ones behind it
  // rather than under them.
  const order = arrows.map((_, index) => index).sort((a, b) => widths[b] - widths[a]);
  for (const index of order) {
    const arrow = arrows[index];
    const path = svg("path", {
      stroke: colorOf(arrow.generator),
      "stroke-width": widths[index],
      "data-generator": arrow.generator,
      "data-from": arrow.from.point,
      "data-to": arrow.to.point,
    });
    shapeArrow(path, arrow, curvature, width, head);
    edges.append(path);
  }
  return edges;
};
