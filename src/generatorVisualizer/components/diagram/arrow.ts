import type { Permutation } from "@shared/mathUtils/groups/permutations";
import { DEFAULT_SETTINGS } from "../../settings";
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

/**
 * How much further each arrow on a shared path bows than the one before it, as
 * a curvature added on top of the chosen one.
 */
export const STACK_CURVATURE_STEP = 0.35;

/**
 * Each arrow's place in its stack, aligned with `arrows`. Different generators
 * can send the same point to the same image, and those arrows would trace the
 * same curve exactly. Rather than hide all but the last, each further arrow on
 * a shared path is given its place, 1, 2, …, and bowed that much further, so
 * they fan out side by side; an arrow alone on its path is at 0. The shared
 * path is the honest picture: it really is one map, induced by several
 * generators.
 */
const stackPositions = (arrows: readonly ActionArrow[]): number[] => {
  const drawn = new Map<string, number>();
  return arrows.map((arrow) => {
    const key = `${arrow.from.point}->${arrow.to.point}`;
    const position = drawn.get(key) ?? 0;
    drawn.set(key, position + 1);
    return position;
  });
};

/**
 * The curvature an arrow at `stack` in its stack is drawn with. Stacked arrows
 * fan away from the chord on the side the chosen curvature bows to, so that a
 * 2-cycle's two directions, which bow to opposite sides, never meet; a
 * straight chord fans to the side a positive curvature would.
 */
const stackedCurvature = (curvature: number, stack: number): number =>
  curvature + (curvature < 0 ? -1 : 1) * stack * STACK_CURVATURE_STEP;

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
export const HEAD_ONLY_DISTANCE = 55;

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
  width: BowWidth = DEFAULT_SETTINGS.arrowBowWidth,
  head: HeadPosition = DEFAULT_SETTINGS.arrowHead,
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
  arrow: ActionArrow & { stack?: number },
  chosenCurvature = DEFAULT_SETTINGS.arrowCurvature,
  width: BowWidth = DEFAULT_SETTINGS.arrowBowWidth,
  head: HeadPosition = DEFAULT_SETTINGS.arrowHead,
): void => {
  const curvature = stackedCurvature(chosenCurvature, arrow.stack ?? 0);
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
 * `width` how that bow grows with an arrow's length, `head` where along it the
 * head is drawn, and `strokeWidth` how thick its line is; the heads scale with it.
 */
export const renderArrows = (
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
  curvature = DEFAULT_SETTINGS.arrowCurvature,
  width: BowWidth = DEFAULT_SETTINGS.arrowBowWidth,
  head: HeadPosition = DEFAULT_SETTINGS.arrowHead,
  strokeWidth = DEFAULT_SETTINGS.arrowWidth,
): SVGGElement => {
  const edges = svg("g", { class: "edges", fill: "none" });
  const stacks = stackPositions(arrows);
  arrows.forEach((arrow, index) => {
    const path = svg("path", {
      stroke: colorOf(arrow.generator),
      "stroke-width": strokeWidth,
      "data-generator": arrow.generator,
      "data-from": arrow.from.point,
      "data-to": arrow.to.point,
      "data-stack": stacks[index],
      id: `arrow-${index}`,
    });
    shapeArrow(path, { ...arrow, stack: stacks[index] }, curvature, width, head);
    edges.append(path);
  });
  focusOnHover(edges);
  return edges;
};

/**
 * While the pointer is over an arrow, single out its generator: every arrow of
 * that generator is marked `focused`, the layer carries the generator as
 * `data-focus` so the stylesheet can fade the rest, and the focused arrows are
 * drawn again on top, as `<use>` copies in a `raised` group at the end of the
 * layer. Leaving the layer drops the copies and the focus.
 *
 * No arrow is ever moved. A browser forgets the transition of an element taken
 * out and put back, so a moved arrow would jump to its new opacity instead of
 * fading; and one moved from under the pointer can lose its leave events too.
 * The copies ignore the pointer, so it is always the arrows themselves that
 * are hovered.
 */
const focusOnHover = (edges: SVGGElement): void => {
  const drawn = Array.from(edges.querySelectorAll<SVGPathElement>("path"));
  const raised = svg("g", { class: "raised", "pointer-events": "none" });

  edges.addEventListener("pointerover", (event) => {
    const generator = drawn.find((path) => path === event.target)?.dataset.generator;
    if (generator === undefined || generator === edges.dataset.focus) return;
    edges.dataset.focus = generator;
    const focused = drawn.filter((path) => path.dataset.generator === generator);
    for (const path of drawn) path.classList.toggle("focused", focused.includes(path));
    raised.replaceChildren(...focused.map((path) => svg("use", { href: `#${path.id}` })));
    // Put back in, so its fade-in starts over for the new generator.
    edges.append(raised);
  });

  edges.addEventListener("pointerleave", () => {
    delete edges.dataset.focus;
    for (const path of drawn) path.classList.remove("focused");
    raised.replaceChildren();
    raised.remove();
  });
};
